"""The traveler's other Conversations, as the advisor is shown they exist.

One trip is planned across several Conversations, and an advisor shown one at
a time would answer as though this were the only place it had been discussed.

A line each: the Conversation's name and the Trip it refines — not a word of
what was *said* in them. Keeping them apart is what the traveler asked for by
starting a second, and what they settled is in the Trip Plan anyway.

Nothing here touches the database; `services/instructions.py` reads the rows.
"""

from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class OtherConversation:
    """One Conversation of the traveler's, other than the one being answered."""

    #: Never null: an unnamed Conversation has had nothing said in it, and the
    #: query leaves those out.
    title: str
    #: Null when it refines no Trip, or when the destination is undecided.
    destination: str | None


def describe(elsewhere: Sequence[OtherConversation]) -> str:
    """The traveler's other Conversations, one line each, most recent first."""
    if not elsewhere:
        return "This is the only conversation the traveler has going with you."
    listed = "\n".join(f"  {_line(other)}" for other in elsewhere)
    return (
        "Other conversations this traveler has going with you, most recently spoken in "
        "first. You are not shown what was said in any of them, and you do not repeat "
        "what is in this one into them — but they exist, so a journey one of them is "
        "plainly about is one the traveler is already planning with you somewhere "
        "else:\n"
        f"{listed}"
    )


def _line(other: OtherConversation) -> str:
    if other.destination is None:
        return other.title
    return f"{other.title} — about {other.destination}"
