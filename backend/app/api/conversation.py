"""The Conversation: reading it back, and adding a turn to it.

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
from fastapi.responses import StreamingResponse
from openai import APIError, AsyncOpenAI
from openai.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor import ReplyFragment, run_turn
from ..config import Settings, get_settings
from ..db import get_session
from ..instructions import compose_system_prompt
from ..model import OpenRouterKeyMissing, create_model_client
from ..models import SOLE_TRAVELER_ID, Conversation, Message, MessageRole
from ..outbound import get_http_client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["conversation"])


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


class ConversationView(BaseModel):
    id: uuid.UUID
    messages: list[MessageView]


class TravelerMessage(BaseModel):
    """What the traveler wants to say."""

    content: str = Field(min_length=1, max_length=8000)


@router.get("/conversation")
async def read_conversation(session: AsyncSession = Depends(get_session)) -> ConversationView:
    """The traveler's Conversation, with everything said in it so far."""
    conversation = await _sole_conversation(session)
    said = await _messages(session, conversation)
    return ConversationView(
        id=conversation.id, messages=[MessageView.of(message) for message in said]
    )


@router.post("/conversation/messages")
async def say(
    saying: TravelerMessage,
    session: AsyncSession = Depends(get_session),
    http_client: httpx2.AsyncClient = Depends(get_http_client),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    """Say something to the advisor and watch the reply arrive."""
    try:
        model = create_model_client(http_client, settings)
    except OpenRouterKeyMissing as missing:
        # Nothing is persisted: the traveler's question is theirs to send again
        # once the key is there.
        raise HTTPException(status_code=503, detail=str(missing)) from missing

    conversation = await _sole_conversation(session)
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
    except APIError as failure:
        # Deliberately not the traveler's words or the model's: the log is not a
        # second copy of the conversation.
        logger.warning("The turn failed: %s", type(failure).__name__)
        yield _event({"type": "failed", "detail": "The advisor could not answer."})


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


async def _sole_conversation(session: AsyncSession) -> Conversation:
    """The traveler's one Conversation, started the first time they need it.

    There is exactly one for now. Several of them, and choosing between them, is
    the next ticket's job.
    """
    conversation = await session.scalar(
        select(Conversation)
        .where(Conversation.traveler_id == SOLE_TRAVELER_ID)
        .order_by(Conversation.created_at)
        .limit(1)
    )
    if conversation is None:
        conversation = Conversation(traveler_id=SOLE_TRAVELER_ID)
        session.add(conversation)
        await session.commit()
    return conversation
