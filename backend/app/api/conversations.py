"""Conversations: keeping several apart, and adding a turn to one of them.

A turn is a streamed response over a POST. What the turn actually does lives in
`services/turns.py`; what is left here is the shape of it on the wire — the
views the browser is sent, and the mapping from what happened to an event.
"""

import uuid
from collections.abc import AsyncIterator
from datetime import datetime
from typing import assert_never

import httpx2
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor.client import OpenRouterKeyMissing, create_model_client
from ..advisor.loop import Consulted, Consulting, ReplyFragment
from ..advisor.prompt import compose_prompt
from ..advisor.tools import LiveDataTools
from ..config import Settings, get_settings
from ..db.connection import get_session
from ..db.conversations import (
    begin_conversation,
    conversations_by_activity,
    find_conversation,
    messages_in,
    record_message,
    remove_conversation,
)
from ..db.tables import Conversation, Message, MessageRole, PromptVersion
from ..db.trips import attach_conversation, find_trip
from ..privacy.outbound import get_http_client
from ..services.instructions import compose_around, current_version
from ..services.plans import plan_of, read_plan
from ..services.turns import (
    Failed,
    Happening,
    PlanRevised,
    ProfileRevised,
    Recorded,
    Titled,
    take_turn,
)
from .sse import event
from .traveler import ProfileFactView
from .trips import TripPlanView

router = APIRouter(tags=["conversations"])


class CitationView(BaseModel):
    """Where something in this Message was fetched from."""

    #: The service's own name, or the site's, as the traveler would recognise it.
    service: str
    about: str
    #: Null when there is nowhere to go and look: a web search that came back
    #: citing no page still leaves the query it sent behind.
    url: str | None
    #: The exact query a web search sent, and null on every other Citation.
    #: Defaulted, because Messages recorded before there was a web search have
    #: no such key stored against them.
    query: str | None = None


class MessageView(BaseModel):
    id: uuid.UUID
    role: MessageRole
    content: str
    created_at: datetime
    #: The Prompt Version whose Advisor Instructions produced this Message, so
    #: that an advisor that started answering differently partway through a
    #: Conversation can be explained rather than wondered at. Null on a
    #: traveler Message, which no prompt produced.
    prompt_version_id: uuid.UUID | None
    #: What the turn that produced this Message cost, in US dollars.
    cost_usd: float | None
    #: Empty unless the turn went and looked something up.
    citations: list[CitationView]

    @classmethod
    def of(cls, message: Message) -> "MessageView":
        return cls(
            id=message.id,
            role=message.role,
            content=message.content,
            created_at=message.created_at,
            prompt_version_id=message.prompt_version_id,
            cost_usd=float(message.cost_usd) if message.cost_usd is not None else None,
            citations=[CitationView.model_validate(cited) for cited in message.citations],
        )


class ConversationSummary(BaseModel):
    """A Conversation as it appears in the list, without its transcript."""

    id: uuid.UUID
    #: Null until the first exchange has been named. The interface says so in its
    #: own words rather than the application inventing a placeholder title.
    title: str | None
    #: When something was last said in this Conversation, or when it was started
    #: if nothing has been said yet.
    last_activity_at: datetime
    #: The Trip this Conversation is refining, and null while it is refining
    #: none. The row carries it so the list can mark which journey a
    #: Conversation belongs to without reading each one to find out.
    trip_id: uuid.UUID | None


class ConversationView(BaseModel):
    id: uuid.UUID
    title: str | None
    messages: list[MessageView]
    #: The Trip Plan this Conversation is refining, and null while it is
    #: refining none. It comes back with the transcript rather than from a
    #: second request, because the plan sits beside the Conversation at all
    #: times and the two are opened together (ADR-0006).
    plan: TripPlanView | None


class ChosenTrip(BaseModel):
    """Which Trip a Conversation is to refine from now on.

    Named as null to take it off the one it is on. Required rather than
    defaulted, so detaching is something asked for rather than something a
    body that forgot to say anything does by accident.
    """

    trip_id: uuid.UUID | None


class TravelerMessage(BaseModel):
    """What the traveler wants to say."""

    content: str = Field(min_length=1, max_length=8000)


@router.get("/conversations")
async def list_conversations(
    session: AsyncSession = Depends(get_session),
) -> list[ConversationSummary]:
    """Every Conversation the traveler has, the most recently active first."""
    return [
        ConversationSummary(
            id=conversation.id,
            title=conversation.title,
            last_activity_at=last_activity_at,
            trip_id=conversation.trip_id,
        )
        for conversation, last_activity_at in await conversations_by_activity(session)
    ]


@router.post("/conversations", status_code=201)
async def start_conversation(
    session: AsyncSession = Depends(get_session),
) -> ConversationSummary:
    """Begin a separate line of thinking."""
    conversation = await begin_conversation(session)
    return ConversationSummary(
        id=conversation.id,
        title=conversation.title,
        last_activity_at=conversation.created_at,
        trip_id=conversation.trip_id,
    )


@router.get("/conversations/{conversation_id}")
async def read_conversation(
    conversation_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> ConversationView:
    """One Conversation, with everything said in it so far."""
    conversation = await _conversation(session, conversation_id)
    said = await messages_in(session, conversation)
    plan = await plan_of(session, conversation)
    return ConversationView(
        id=conversation.id,
        title=conversation.title,
        messages=[MessageView.of(message) for message in said],
        plan=None if plan is None else TripPlanView.of(plan),
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> Response:
    """Remove a Conversation and everything said in it, for good.

    There is no flag and no hidden row: the Messages go with it, on the
    database's own cascade. Asking the traveler first is the interface's job,
    because by the time the request arrives the decision has been made.
    """
    await remove_conversation(session, await _conversation(session, conversation_id))
    return Response(status_code=204)


@router.put("/conversations/{conversation_id}/trip")
async def attach_to_trip(
    conversation_id: uuid.UUID,
    chosen: ChosenTrip,
    session: AsyncSession = Depends(get_session),
) -> TripPlanView | None:
    """Move a Conversation to a different Trip, or take it off the one it is on.

    Which Trip a Conversation belongs to is the advisor's guess, and one it can
    get wrong — so correcting it is the traveler's (ADR-0002). What comes back
    is the Trip Plan this Conversation refines from here, and null when it
    refines none, because that is what the pane beside it has to show next.
    """
    conversation = await _conversation(session, conversation_id)
    trip = None
    if chosen.trip_id is not None:
        trip = await find_trip(session, chosen.trip_id)
        if trip is None:
            raise HTTPException(status_code=404, detail="No such Trip.")
    await attach_conversation(session, conversation, trip)
    return None if trip is None else TripPlanView.of(await read_plan(session, trip))


@router.post("/conversations/{conversation_id}/messages")
async def say(
    conversation_id: uuid.UUID,
    saying: TravelerMessage,
    session: AsyncSession = Depends(get_session),
    http_client: httpx2.AsyncClient = Depends(get_http_client),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    """Say something to the advisor and watch the reply arrive."""
    conversation = await _conversation(session, conversation_id)
    try:
        model = create_model_client(http_client, settings)
    except OpenRouterKeyMissing as missing:
        # Nothing is persisted: the traveler's question is theirs to send again
        # once the key is there.
        raise HTTPException(status_code=503, detail=str(missing)) from missing

    # Recorded before the model is called, so a turn that fails mid-stream still
    # leaves the traveler's own words where they said them.
    traveler_message = await record_message(
        session, conversation, role=MessageRole.TRAVELER, content=saying.content
    )

    # Read at the top of every turn rather than held anywhere, which is the
    # whole of what makes an edit to the Advisor Instructions take effect on
    # the very next Message of a Conversation that was already under way.
    prompt_version = await current_version(session)
    prompt = compose_prompt(
        await messages_in(session, conversation),
        # Composed from what is recorded at the top of the turn, so the advisor
        # reads the plan as it stands and is shown the profile every other
        # Conversation is shown — which is why a brand-new one does not ask
        # what the last one was told.
        await compose_around(session, conversation, prompt_version.instructions),
    )
    return StreamingResponse(
        _turn_events(
            session,
            conversation,
            traveler_message,
            model,
            prompt,
            prompt_version,
            LiveDataTools(http_client, model, utility_model=settings.utility_model),
            settings,
        ),
        media_type="text/event-stream",
        headers={"cache-control": "no-store", "x-accel-buffering": "no"},
    )


async def _turn_events(
    session: AsyncSession,
    conversation: Conversation,
    traveler_message: Message,
    model: AsyncOpenAI,
    prompt: list[ChatCompletionMessageParam],
    prompt_version: PromptVersion,
    tools: LiveDataTools,
    settings: Settings,
) -> AsyncIterator[bytes]:
    """The turn as the browser reads it."""
    yield _message_event("traveler_message", traveler_message)
    async for happening in take_turn(
        session, conversation, traveler_message, model, prompt, prompt_version, tools, settings
    ):
        yield _as_event(happening)


def _as_event(happening: Happening) -> bytes:
    """What happened, in the words the browser's stream reader knows.

    Exhaustive on purpose rather than falling through to a default: a turn that
    grows a new kind of happening — a Trip Plan patch in 09 — should fail the
    type check here rather than quietly reach the browser wearing the last
    branch's name.
    """
    if isinstance(happening, ReplyFragment):
        return event({"type": "fragment", "text": happening.text})
    if isinstance(happening, Consulting):
        return event({"type": "consulting", "activity": happening.activity})
    if isinstance(happening, Consulted):
        return event({"type": "consulted"})
    if isinstance(happening, PlanRevised):
        return event(
            {
                "type": "plan_revised",
                "plan": TripPlanView.of(happening.plan).model_dump(mode="json"),
                "changed": list(happening.changed),
            }
        )
    if isinstance(happening, ProfileRevised):
        return event(
            {
                "type": "profile_revised",
                "profile": [
                    ProfileFactView.of(fact).model_dump(mode="json")
                    for fact in happening.profile
                ],
            }
        )
    if isinstance(happening, Recorded):
        return _message_event("advisor_message", happening.message)
    if isinstance(happening, Titled):
        return event({"type": "conversation_titled", "title": happening.title})
    if isinstance(happening, Failed):
        return event({"type": "failed", "detail": happening.detail})
    assert_never(happening)


def _message_event(kind: str, message: Message) -> bytes:
    return event({"type": kind, "message": MessageView.of(message).model_dump(mode="json")})


async def _conversation(session: AsyncSession, conversation_id: uuid.UUID) -> Conversation:
    """The named Conversation, or a refusal the interface can act on."""
    conversation = await find_conversation(session, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="No such Conversation.")
    return conversation
