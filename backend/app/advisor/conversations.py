"""The traveler's other Conversations, as the advisor is shown they exist.

A traveler plans one trip across several Conversations: they ask about flights in
one, come back a week later and start another about what to do when they land. The
advisor is shown one Conversation at a time and would otherwise have no idea the
others are there — so it answers as though this were the only place the trip has
ever been discussed.

What is composed in is a line each: the name the Conversation was given after its
first exchange, and the Trip it is refining. Not a word of what was *said* in
them. Keeping Conversations apart is what the traveler asked for by starting a
second one, and what they settled about a journey is in the Trip Plan, which the
advisor is shown in full. All this has to do is stop the advisor being surprised
that the others are there.

Nothing here touches the database; `services/instructions.py` reads the rows and
composes what this describes into the one system prompt.
"""

from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class OtherConversation:
    """One Conversation of the traveler's, other than the one being answered."""

    #: What it was named after its first exchange. A Conversation nothing has
    #: been said in yet has no name and is not worth mentioning, so there is no
    #: null here — the query leaves those out.
    title: str
    #: Where the Trip it is refining is going, and null when it is refining no
    #: Trip or when the destination is still undecided.
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
