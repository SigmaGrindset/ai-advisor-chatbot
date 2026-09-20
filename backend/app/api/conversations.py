"""Conversations: keeping several apart, and adding a turn to one of them.

A turn is a streamed response over a POST. What the turn actually does lives in
`services/turns.py`; what is left here is the shape of it on the wire — the
views the browser is sent, and the mapping from what happened to an event.
"""

import uuid
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Annotated, assert_never

import httpx2
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor import failures
from ..advisor.client import OpenRouterKeyMissing, create_model_client
from ..advisor.loop import Consulted, Consulting, ReplyFragment
from ..advisor.prompt import compose_prompt
from ..advisor.failures import Failure, FailureKind
from ..advisor.titles import MAX_TITLE
from ..advisor.tools import LiveDataTools
from ..config import Settings, get_settings
from ..db.connection import get_session
from ..db.conversations import (
    begin_conversation,
    conversations_by_activity,
    discard_message,
    find_conversation,
    last_activity_in,
    messages_in,
    record_message,
    remove_conversation,
    retitle_conversation,
)
from ..db.tables import Conversation, Message, MessageRole, PromptVersion
from ..db.trips import attach_conversation, find_trip
from ..privacy.outbound import get_http_client
from ..services.compaction import compact
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


class FailureView(BaseModel):
    """Why the turn that produced a Message did not finish.

    The kind is what the interface labels it with, and is the whole of what
    tells a traveler with no key from a traveler with no credit from a bug
    here. The detail is the sentence under that label.
    """

    kind: FailureKind
    detail: str


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
    #: Why the turn that produced this Message stopped, and null when it did
    #: not. An advisor Message carrying one holds whatever had arrived of the
    #: reply, which may be nothing — the marker is what tells a turn that died
    #: from an advisor with nothing to say. Defaulted, because Messages
    #: recorded before there was a marker have no such key stored against them.
    failure: FailureView | None = None

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
            failure=(
                None if message.failure is None else FailureView.model_validate(message.failure)
            ),
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


class ChosenTitle(BaseModel):
    """What the traveler wants this Conversation called.

    Bounded at the length the advisor's own naming is bounded at, because it is
    the same line in the same list: a title is what a Conversation is
    recognised by in a rail one row high.

    Trimmed before it is measured, so a name of nothing but spaces is refused
    rather than stored. An unnamed Conversation can still be named by its next
    exchange; one named the empty string could not be.
    """

    title: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_TITLE)
    ]


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


@router.put("/conversations/{conversation_id}/title")
async def rename_conversation(
    conversation_id: uuid.UUID,
    chosen: ChosenTitle,
    session: AsyncSession = Depends(get_session),
) -> ConversationSummary:
    """Call a Conversation something the traveler recognises it by.

    The advisor names a Conversation after its first exchange and never again,
    so this is the only thing that ever renames one — and a Conversation the
    traveler names first is one the advisor then leaves alone, which is the
    same rule read from the other side (`services/turns.py`).

    A rename is not activity: it changes what the row says, never where the row
    sits. What comes back is that row as the list now reads it, because the
    list is the thing that was just renamed.
    """
    conversation = await _conversation(session, conversation_id)
    await retitle_conversation(session, conversation, chosen.title)
    return ConversationSummary(
        id=conversation.id,
        title=conversation.title,
        last_activity_at=await last_activity_in(session, conversation),
        trip_id=conversation.trip_id,
    )


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
    # Before anything is recorded, so a machine with no key leaves the
    # traveler's question in the composer rather than in a transcript with
    # nothing under it.
    model = _model(http_client, settings)

    # Recorded before the model is called, so a turn that fails mid-stream still
    # leaves the traveler's own words where they said them.
    traveler_message = await record_message(
        session, conversation, role=MessageRole.TRAVELER, content=saying.content
    )
    return await _turn(
        session, conversation, traveler_message, model, http_client, settings, announce=True
    )


@router.post("/conversations/{conversation_id}/messages/{message_id}/again")
async def run_again(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    http_client: httpx2.AsyncClient = Depends(get_http_client),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    """Run a failed turn again, in place of the reply it never gave.

    The named Message is the one the failed turn left behind. It goes, and the
    turn is run again from the question that is already recorded — which is the
    whole point of this route existing rather than the interface sending the
    words a second time: a turn that failed would otherwise leave the same
    question in the transcript twice, once with an answer and once without.

    Only the last turn of a Conversation can be run again. A reply arriving in
    the middle of a transcript would answer a question the traveler has since
    moved on from, and would be written after everything it was meant to come
    before.
    """
    conversation = await _conversation(session, conversation_id)
    model = _model(http_client, settings)
    said = await messages_in(session, conversation)
    failed = said[-1] if said else None
    if failed is None or failed.id != message_id:
        raise HTTPException(
            status_code=409, detail="Only the last turn of a Conversation can be run again."
        )
    if failed.failure is None:
        raise HTTPException(status_code=409, detail="That turn did not fail.")
    asked = said[-2] if len(said) > 1 else None
    if asked is None or asked.role is not MessageRole.TRAVELER:
        raise HTTPException(status_code=409, detail="That turn has no question to run again.")

    # Gone before the prompt is composed, so the advisor is asked the question
    # rather than asked to finish its own half-sentence.
    await discard_message(session, failed)
    return await _turn(
        session, conversation, asked, model, http_client, settings, announce=False
    )


def _model(http_client: httpx2.AsyncClient, settings: Settings) -> AsyncOpenAI:
    """The model client, or a refusal that says which setting is missing."""
    try:
        return create_model_client(http_client, settings)
    except OpenRouterKeyMissing as missing:
        # Structured rather than a sentence, so the interface labels it the
        # same way it labels a failure that happens mid-turn — a traveler
        # staring at a machine with no key is told it is a configuration
        # problem, in the one place they are looking.
        raise HTTPException(status_code=503, detail=_refusal(failures.NO_KEY)) from missing


async def _turn(
    session: AsyncSession,
    conversation: Conversation,
    traveler_message: Message,
    model: AsyncOpenAI,
    http_client: httpx2.AsyncClient,
    settings: Settings,
    *,
    announce: bool,
) -> StreamingResponse:
    """One turn, composed and handed to the browser as it happens.

    Both ways into a turn compose it the same way, because they are the same
    turn: the only difference is whether the question it answers is one the
    traveler has just asked or one already in the transcript.
    """
    # Read at the top of every turn rather than held anywhere, which is the
    # whole of what makes an edit to the Advisor Instructions take effect on
    # the very next Message of a Conversation that was already under way.
    prompt_version = await current_version(session)
    # Folded before the prompt is composed rather than after the reply has
    # gone, so a Conversation that has crossed the budget never sends the long
    # prompt even once. What comes back is what is still sent verbatim; the
    # rest of it is in the rolling summary `compose_around` reads back below.
    prompt = compose_prompt(
        await compact(session, conversation, model, settings),
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
            announce=announce,
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
    *,
    announce: bool,
) -> AsyncIterator[bytes]:
    """The turn as the browser reads it.

    The traveler's own Message opens the turn that recorded it, and not one
    running an earlier turn again: that question is on their screen already,
    and announcing it a second time would draw it twice.
    """
    if announce:
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
        # The Message goes with it: the failure is recorded against the half a
        # reply that arrived, and the interface needs to know which Message to
        # offer running again.
        return event(
            {
                "type": "failed",
                **_refusal(happening.failure),
                "message": MessageView.of(happening.message).model_dump(mode="json"),
            }
        )
    assert_never(happening)


def _refusal(failure: Failure) -> dict[str, str]:
    """A failure as the browser reads it, wherever it is being told about one.

    Through the view rather than from the service's own object, so that what a
    failed turn looks like on the wire is decided here with every other shape
    the browser is sent — and so that the refusal of a turn that never started
    and the failure of one that did are the same two keys.
    """
    return FailureView(kind=failure.kind, detail=failure.detail).model_dump(mode="json")


def _message_event(kind: str, message: Message) -> bytes:
    return event({"type": kind, "message": MessageView.of(message).model_dump(mode="json")})


async def _conversation(session: AsyncSession, conversation_id: uuid.UUID) -> Conversation:
    """The named Conversation, or a refusal the interface can act on."""
    conversation = await find_conversation(session, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="No such Conversation.")
    return conversation
