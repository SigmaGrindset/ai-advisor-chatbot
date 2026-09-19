"""The Traveler Profile tools: what the advisor calls when it learns something.

The second collection that writes, beside the Trip Plan tools next door, and
held to the same rule: these write and never fetch, and the loop dispatches
them down the branch that has no tool result in front of it. That is what
makes it structurally impossible for a page the advisor read to put something
into the traveler's profile (ADR-0004, ADR-0010).

A fact is recorded under a subject, and three of the four subjects are ones a
traveler has exactly one of. Recording a nationality when a nationality is
already there *replaces* it, so a correction made in conversation updates what
is stored rather than standing a contradiction beside it. That rule is the
application's rather than the advisor's: a profile that only stayed consistent
while the model was careful would not be one (ADR-0001).

Nothing in here touches the database. A call is read into a typed change, and
`services/profile.py` is what knows how to apply one — the same line the rest
of `advisor/` sits on.
"""

import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

from openai.types.chat import ChatCompletionToolParam

from .calls import Tool, Unusable, read_call, words, whole

#: How long a fact may run. A Profile Fact is a line about the traveler, not a
#: paragraph about them.
MAX_DETAIL = 200

#: What a Profile Fact can be about. The first three are the fixed set the
#: advisor is asked for by name, because they are what it otherwise asks the
#: traveler for twice; `note` is the collection for everything a fixed set
#: could not anticipate — a constraint, a preference, a way they like to travel.
NATIONALITY = "nationality"
HOME_CITY = "home_city"
COMPANIONS = "companions"
NOTE = "note"

SUBJECTS = (NATIONALITY, HOME_CITY, COMPANIONS, NOTE)

#: The subjects a traveler has exactly one of. Recording one of these again is
#: a correction, and lands as one.
ONE_EACH = frozenset({NATIONALITY, HOME_CITY, COMPANIONS})

#: How each subject is said, wherever a fact is read rather than stored.
LABELS = {
    NATIONALITY: "Nationality",
    HOME_CITY: "Home city",
    COMPANIONS: "Travels with",
    NOTE: "Note",
}


# ---- What the advisor can ask for ----------------------------------------- #


@dataclass(frozen=True, slots=True)
class Remember:
    """Record one durable thing about the traveler."""

    subject: str
    detail: str


@dataclass(frozen=True, slots=True)
class Forget:
    """Take one fact off the profile."""

    #: The fact's number, as the profile in the prompt lists it.
    fact: int


ProfileChange = Remember | Forget


@dataclass(frozen=True, slots=True)
class Learned:
    """What became of a change to the profile.

    `told` is the tool result, in the application's own voice — not wrapped in
    the untrusted markers a Live-data Tool result wears, for the same reason a
    plan tool's result is not: this is the application's account of a write it
    made itself.
    """

    told: str
    #: Whether the profile the traveler is looking at is now out of date. False
    #: for a change that was refused, and for one the profile already said.
    revised: bool = False


class Profile(Protocol):
    """Whatever can actually apply a change to the Traveler Profile.

    Implemented above this layer, where the database is. Declared here so the
    loop can be handed one without `advisor/` learning what a session is.
    """

    async def change(self, asked: ProfileChange) -> Learned: ...


# ---- The profile as the advisor is shown it -------------------------------- #


@dataclass(frozen=True, slots=True)
class Fact:
    """One Profile Fact, as the prompt and the interface are shown it."""

    #: What the interface addresses it by. The advisor never sees this one.
    id: uuid.UUID
    #: Its number, which is how the advisor refers to it.
    ref: int
    subject: str
    detail: str


def describe(facts: Sequence[Fact]) -> str:
    """The Traveler Profile as the advisor is shown it at the top of a turn.

    Every entry carries the number `forget_profile_fact` takes, and this is the
    whole of what a brand-new Conversation knows about the traveler.
    """
    if not facts:
        return (
            "You have recorded nothing about this traveler yet. Anything durable you "
            "learn about them, record as you learn it."
        )
    listed = "\n".join(f"  [{fact.ref}] {LABELS[fact.subject]}: {fact.detail}" for fact in facts)
    return (
        "What you already know about this traveler, from every conversation they have "
        "had with you. You know these things now, in this conversation, whether or not "
        "they were said in it — so do not ask about any of them again:\n"
        f"{listed}"
    )


# ---- Reading a call ------------------------------------------------------- #


#: One profile tool, as the model is offered it. The shape is shared with the
#: Trip Plan's catalogue next door — see `calls.py`.
ProfileTool = Tool[ProfileChange]


def offers(name: str) -> bool:
    """Whether this call is one of ours rather than another collection's."""
    return name in _BY_NAME


def offered() -> list[ChatCompletionToolParam]:
    """What the model is told it can remember and forget."""
    return [tool.offered() for tool in CATALOGUE]


async def change(profile: Profile, name: str, arguments: str) -> Learned:
    """Read one call and apply it, answering with what to tell the advisor.

    Never raises. A call carrying arguments that are not what the tool takes
    becomes something the advisor is told about and can correct, rather than
    something that ends the turn.
    """
    asked = read_call(_BY_NAME, name, arguments)
    if isinstance(asked, Unusable):
        return Learned(told=asked.complaint)
    return await profile.change(asked)


def _read_remember(given: Mapping[str, Any]) -> ProfileChange | Unusable:
    subject = given.get("subject")
    if subject not in SUBJECTS:
        return Unusable(
            f"A fact is about one of {', '.join(SUBJECTS)}. Anything the first three do "
            "not cover is a note."
        )
    detail = words(given.get("detail"), longest=MAX_DETAIL)
    if detail is None:
        return Unusable(
            "A fact needs its detail: what you learned, in a line the traveler would "
            "recognise as what they told you."
        )
    return Remember(subject=subject, detail=detail)


def _read_forget(given: Mapping[str, Any]) -> ProfileChange | Unusable:
    fact = whole(given.get("fact"), least=1)
    if fact is None:
        return Unusable("Forgetting a fact needs its number, as the profile lists it.")
    return Forget(fact)


CATALOGUE: Sequence[ProfileTool] = (
    ProfileTool(
        name="remember_profile_fact",
        description=(
            "Record one durable thing about the traveler, so you still know it in every "
            "conversation they have with you from now on. Call it the moment they tell "
            "you something that will still be true of their next trip. If what you "
            "record turns out to be wrong, record it again with the correction — "
            "nationality, home city and who they travel with hold one fact each, so the "
            "new one replaces the old rather than sitting beside it."
        ),
        arguments={
            "type": "object",
            "properties": {
                "subject": {
                    "type": "string",
                    "enum": list(SUBJECTS),
                    "description": (
                        "What the fact is about. Use 'note' for anything the other three "
                        "do not cover — a constraint, a preference, how they like to travel."
                    ),
                },
                "detail": {
                    "type": "string",
                    "maxLength": MAX_DETAIL,
                    "description": (
                        "The fact, in a line: 'Croatian', 'Zagreb', 'usually travels with "
                        "her partner and their two children', 'will not fly overnight'."
                    ),
                },
            },
            "required": ["subject", "detail"],
            "additionalProperties": False,
        },
        read=_read_remember,
    ),
    ProfileTool(
        name="forget_profile_fact",
        description=(
            "Take one fact off the profile, by the number the profile lists it under. "
            "Call this when the traveler says something you recorded is no longer true "
            "and there is nothing to put in its place."
        ),
        arguments={
            "type": "object",
            "properties": {
                "fact": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "The fact's number, as the profile you were shown lists it.",
                },
            },
            "required": ["fact"],
            "additionalProperties": False,
        },
        read=_read_forget,
    ),
)

_BY_NAME = {tool.name: tool for tool in CATALOGUE}
