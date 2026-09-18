"""Everything the model is shown for one turn, composed on the server.

Today that is the Advisor Instructions and the Conversation so far. Ticket 09
injects the Trip Plan and ticket 11 the Traveler Profile, both of them around
the instructions rather than inside them (CONTEXT.md draws that line, and the
Advisor Instructions page in 12 shows the traveler both parts separately).

Nothing here reads the database: it is handed what was said and answers with
what to send, so what the advisor sees is one pure function of what is
recorded, and a test can ask for it without a session.
"""

from collections.abc import Sequence

from openai.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)

from ..db.tables import Message, MessageRole
from .instructions import compose_system_prompt


def compose_prompt(said: Sequence[Message]) -> list[ChatCompletionMessageParam]:
    """The whole of what the model is sent for this turn."""
    return [
        ChatCompletionSystemMessageParam(role="system", content=compose_system_prompt()),
        *(_as_model_message(message) for message in said),
    ]


def _as_model_message(message: Message) -> ChatCompletionMessageParam:
    """A Message in the vocabulary the model speaks rather than the domain's."""
    if message.role is MessageRole.TRAVELER:
        return ChatCompletionUserMessageParam(role="user", content=message.content)
    return ChatCompletionAssistantMessageParam(role="assistant", content=message.content)
