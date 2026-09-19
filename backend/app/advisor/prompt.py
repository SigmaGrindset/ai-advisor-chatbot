"""Everything the model is shown for one turn, in the vocabulary it speaks.

The system prompt, and then the Conversation so far. What goes *into* the
system prompt is `instructions.py`'s — the Advisor Instructions, with the Trip
Plan, the Traveler Profile and the tool guidance composed around rather than
inside them (CONTEXT.md draws that line, and the Advisor Instructions page
shows the traveler both parts separately).

Nothing here reads the database: it is handed what was said and what the
advisor is told, and answers with what to send, so what the advisor sees is
one pure function of what is recorded and a test can ask for it without a
session.
"""

from collections.abc import Sequence

from openai.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)

from ..db.tables import Message, MessageRole


def compose_prompt(said: Sequence[Message], system: str) -> list[ChatCompletionMessageParam]:
    """The whole of what the model is sent for this turn.

    The system prompt is passed in rather than composed here, and composed by
    `services/instructions.py::compose_around` for the turn and for the page
    that shows the traveler what the turn will send — one composition, so that
    what they are shown cannot drift from what is sent.

    A Message whose turn failed is left out. The traveler keeps it — it is
    where their question went and how they ask it again — but what
    it holds is a sentence the advisor never finished, or nothing at all, and
    sending either back would have the advisor take a half-written thought for
    something it had decided to say.
    """
    return [
        ChatCompletionSystemMessageParam(role="system", content=system),
        *(_as_model_message(message) for message in said if message.failure is None),
    ]


def _as_model_message(message: Message) -> ChatCompletionMessageParam:
    """A Message in the vocabulary the model speaks rather than the domain's."""
    if message.role is MessageRole.TRAVELER:
        return ChatCompletionUserMessageParam(role="user", content=message.content)
    return ChatCompletionAssistantMessageParam(role="assistant", content=message.content)
