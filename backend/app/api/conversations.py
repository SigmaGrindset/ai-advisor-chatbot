"""Conversations: keeping several apart, and adding a turn to one of them.

A turn is a streamed response over a POST. The events are hand-rolled
server-sent events, one JSON object per event, so the browser can read the reply
as it is written rather than waiting for the whole of it.
"""

import json
import logging
import uuid
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any

import httpx2
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from openai import APIError, AsyncOpenAI
from openai.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor import ReplyFragment, run_turn
from ..config import Settings, get_settings
from ..db import get_session
from ..instructions import compose_system_prompt
from ..model import OpenRouterKeyMissing, create_model_client
from ..models import SOLE_TRAVELER_ID, Conversation, Message, MessageRole
from ..outbound import get_http_client
from ..titles import name_conversation

logger = logging.getLogger(__name__)

router = APIRouter(tags=["conversations"])


class MessageView(BaseModel):
    id: uuid.UUID
    role: MessageRole
    content: str
    created_at: datetime
    #: What the turn that produced this Message cost, in US dollars.
    cost_usd: float | None

    @classmethod
    def of(cls, message: Message) -> "MessageView":
        return cls(
            id=message.id,
            role=message.role,
            content=message.content,
            created_at=message.created_at,
            cost_usd=float(message.cost_usd) if message.cost_usd is not None else None,
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


class ConversationView(BaseModel):
    id: uuid.UUID
    title: str | None
    messages: list[MessageView]


class TravelerMessage(BaseModel):
    """What the traveler wants to say."""

    content: str = Field(min_length=1, max_length=8000)


#: The moment of the last Message, or the Conversation's own beginning while it
#: has none. Derived rather than stored, so there is one clock and no way for a
#: recorded timestamp to drift from what was actually said.
_LAST_ACTIVITY = func.coalesce(
    select(func.max(Message.created_at))
    .where(Message.conversation_id == Conversation.id)
    .correlate(Conversation)
    .scalar_subquery(),
    Conversation.created_at,
)


@router.get("/conversations")
async def list_conversations(
    session: AsyncSession = Depends(get_session),
) -> list[ConversationSummary]:
    """Every Conversation the traveler has, the most recently active first."""
    rows = await session.execute(
        select(Conversation, _LAST_ACTIVITY.label("last_activity_at"))
        .where(Conversation.traveler_id == SOLE_TRAVELER_ID)
        # By id second, so Conversations whose last activity falls in the same
        # instant still come back in a settled order rather than an arbitrary one.
        .order_by(_LAST_ACTIVITY.desc(), Conversation.id)
    )
    return [
        ConversationSummary(
            id=conversation.id, title=conversation.title, last_activity_at=last_activity_at
        )
        for conversation, last_activity_at in rows
    ]


@router.post("/conversations", status_code=201)
async def start_conversation(
    session: AsyncSession = Depends(get_session),
) -> ConversationSummary:
    """Begin a separate line of thinking."""
    conversation = Conversation(traveler_id=SOLE_TRAVELER_ID)
    session.add(conversation)
    await session.commit()
    return ConversationSummary(
        id=conversation.id, title=conversation.title, last_activity_at=conversation.created_at
    )


@router.get("/conversations/{conversation_id}")
async def read_conversation(
    conversation_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> ConversationView:
    """One Conversation, with everything said in it so far."""
    conversation = await _conversation(session, conversation_id)
    said = await _messages(session, conversation)
    return ConversationView(
        id=conversation.id,
        title=conversation.title,
        messages=[MessageView.of(message) for message in said],
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
    conversation = await _conversation(session, conversation_id)
    await session.delete(conversation)
    await session.commit()
    return Response(status_code=204)


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

    traveler_message = Message(
        conversation_id=conversation.id,
        role=MessageRole.TRAVELER,
        content=saying.content,
    )
    session.add(traveler_message)
    # Committed before the model is called, so a turn that fails mid-stream still
    # leaves the traveler's own words where they said them.
    await session.commit()

    prompt = await _compose_prompt(session, conversation)
    return StreamingResponse(
        _turn_events(session, conversation, traveler_message, model, prompt, settings),
        media_type="text/event-stream",
        headers={"cache-control": "no-store", "x-accel-buffering": "no"},
    )


async def _turn_events(
    session: AsyncSession,
    conversation: Conversation,
    traveler_message: Message,
    model: AsyncOpenAI,
    prompt: list[ChatCompletionMessageParam],
    settings: Settings,
) -> AsyncIterator[bytes]:
    traveler_view = MessageView.of(traveler_message)
    yield _event({"type": "traveler_message", "message": traveler_view.model_dump(mode="json")})
    try:
        async for event in run_turn(model, model_name=settings.conversation_model, prompt=prompt):
            if isinstance(event, ReplyFragment):
                yield _event({"type": "fragment", "text": event.text})
                continue
            advisor_message = Message(
                conversation_id=conversation.id,
                role=MessageRole.ADVISOR,
                content=event.content,
                cost_usd=event.cost_usd,
            )
            session.add(advisor_message)
            await session.commit()
            advisor_view = MessageView.of(advisor_message)
            yield _event(
                {"type": "advisor_message", "message": advisor_view.model_dump(mode="json")}
            )
            # Last, because naming is another round trip to another model. The
            # traveler's turn is over by the time it starts, so a slow or failing
            # naming call costs them nothing but a title arriving a moment later.
            named = await _name_unless_named(
                session, conversation, traveler_message, advisor_message, model, settings
            )
            if named is not None:
                yield _event({"type": "conversation_titled", "title": named})
    except APIError as failure:
        # Deliberately not the traveler's words or the model's: the log is not a
        # second copy of the conversation.
        logger.warning("The turn failed: %s", type(failure).__name__)
        yield _event({"type": "failed", "detail": "The advisor could not answer."})


async def _name_unless_named(
    session: AsyncSession,
    conversation: Conversation,
    traveler_message: Message,
    advisor_message: Message,
    model: AsyncOpenAI,
    settings: Settings,
) -> str | None:
    """Name a Conversation after the first exchange that completed in it.

    Answers with the name if this turn is the one that earned it, and None
    otherwise — because the Conversation already had a name, which is written
    once and never rewritten underneath a traveler who has learnt to recognise
    it, or because this exchange left nothing to name it by.
    """
    if conversation.title is not None:
        return None
    named = await name_conversation(
        model,
        model_name=settings.utility_model,
        traveler_said=traveler_message.content,
        advisor_said=advisor_message.content,
    )
    if named is None:
        return None
    conversation.title = named
    await session.commit()
    return named


def _event(payload: dict[str, Any]) -> bytes:
    return f"data: {json.dumps(payload)}\n\n".encode()


async def _compose_prompt(
    session: AsyncSession, conversation: Conversation
) -> list[ChatCompletionMessageParam]:
    """Everything the model is shown for this turn, composed on the server."""
    said = await _messages(session, conversation)
    return [
        ChatCompletionSystemMessageParam(role="system", content=compose_system_prompt()),
        *(_as_model_message(message) for message in said),
    ]


def _as_model_message(message: Message) -> ChatCompletionMessageParam:
    """A Message in the vocabulary the model speaks rather than the domain's."""
    if message.role is MessageRole.TRAVELER:
        return ChatCompletionUserMessageParam(role="user", content=message.content)
    return ChatCompletionAssistantMessageParam(role="assistant", content=message.content)


async def _messages(session: AsyncSession, conversation: Conversation) -> list[Message]:
    """Everything said in this Conversation, in the order it was said."""
    messages = await session.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at, Message.id)
    )
    return list(messages)


async def _conversation(session: AsyncSession, conversation_id: uuid.UUID) -> Conversation:
    """The named Conversation, or a refusal the interface can act on."""
    conversation = await session.get(Conversation, conversation_id)
    if conversation is None or conversation.traveler_id != SOLE_TRAVELER_ID:
        raise HTTPException(status_code=404, detail="No such Conversation.")
    return conversation
