"""Everything the model is shown for one turn, composed on the server.

The Advisor Instructions, the Trip Plan, the Traveler Profile and the
Conversation so far — the three injected records composed *around* the
instructions rather than inside them (CONTEXT.md draws that line, and the
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
from .planning import TripPlan, TripSummary
from .remembering import Fact


def compose_prompt(
    said: Sequence[Message],
    plan: TripPlan | None = None,
    trips: Sequence[TripSummary] = (),
    profile: Sequence[Fact] = (),
) -> list[ChatCompletionMessageParam]:
    """The whole of what the model is sent for this turn.

    The plan is the Trip Plan of the Trip this Conversation is attached to, and
    None while it is attached to none. `trips` is every Trip the traveler has,
    which is the list `join_trip` picks out of. The profile is everything the
    advisor has learned about the traveler, in every Conversation — which is
    why a brand-new one already knows their nationality.
    """
    return [
        ChatCompletionSystemMessageParam(
            role="system", content=compose_system_prompt(plan, trips, profile)
        ),
        *(_as_model_message(message) for message in said),
    ]


def _as_model_message(message: Message) -> ChatCompletionMessageParam:
    """A Message in the vocabulary the model speaks rather than the domain's."""
    if message.role is MessageRole.TRAVELER:
        return ChatCompletionUserMessageParam(role="user", content=message.content)
    return ChatCompletionAssistantMessageParam(role="assistant", content=message.content)
