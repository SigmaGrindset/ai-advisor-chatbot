"""Everything the model is shown for one turn, in the vocabulary it speaks.

The system prompt, then the Conversation so far. What goes *into* the system
prompt is `instructions.py`'s: the Advisor Instructions, with the plan, the
profile and the tool guidance composed around rather than inside them.

Nothing here reads the database, so what the advisor sees is one pure function
of what is recorded and a test can ask for it without a session.
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

    The system prompt is passed in rather than composed here, so the turn and
    the page previewing it share one composition.

    A Message whose turn failed is left out. The traveler keeps it, but what
    it holds is a sentence the advisor never finished, and sending it back
    would have the advisor take that for something it decided to say.
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
