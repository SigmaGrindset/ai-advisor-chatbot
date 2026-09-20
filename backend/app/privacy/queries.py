"""The one free-text thing that leaves this application, read before it does.

A search query is the only argument of any Live-data Tool that carries the
traveler's words, so it is the one place free text crosses the boundary
ADR-0004 draws.

What is looked for is not "personal data" — no regular expression finds that —
but the handful of *shapes* a document number takes. Shapes rather than nearby
words, because "my passport expires in 2027, do I need six months on it for
Japan?" deserves an answer and a rule keyed on "passport" would gut it.

A query carrying a shape has it taken out and goes on without it; one that was
nothing but a shape is refused. Stripping rather than refusing outright is
deliberate (ADR-0009): a visa question is still a visa question.
"""

import re
from collections.abc import Sequence
from dataclasses import dataclass

#: A search is a question, not a paragraph, and prose is where a traveler's
#: whole situation would travel.
MAX_QUERY = 160

#: The shapes a document number takes, each with what to call it in words.
#: Tried in order, so the widest net is cast last and what is reported is the
#: most specific match rather than "a long number" every time.
_SHAPES: Sequence[tuple[str, re.Pattern[str]]] = (
    # A card or account number in the groups people write them in. Three digits
    # to a group at least, which keeps a date range from matching.
    ("a payment card or account number", re.compile(r"\b\d{3,}(?:[ \-]\d{3,}){2,}\b")),
    # The one national identity number with a shape of its own.
    ("a national identity number", re.compile(r"\b\d{3}[ \-]\d{2}[ \-]\d{4}\b")),
    # A passport number as most countries issue one. Separated only when the
    # letters are capitals: "AB 123456" is a document, "up to 1200000" a budget.
    (
        "a passport or document number",
        re.compile(r"\b(?:[A-Za-z]{1,2}\d{6,9}|[A-Z]{1,2}[ \-]\d{6,9})\b"),
    ),
    # And as the rest issue one — Germany's "C01X00T47". Eight to twelve mixed
    # characters with at least two digits; a year or flight number is shorter or
    # has one run of digits. A letter is required so plain runs fall through.
    (
        "a passport or document number",
        re.compile(
            r"\b(?=[A-Za-z0-9]{8,12}\b)(?=(?:[A-Za-z]*\d){2})(?=[A-Za-z0-9]*[A-Za-z])"
            r"[A-Za-z0-9]+\b"
        ),
    ),
    # What all of the above are once punctuation is dropped. Eight digits is
    # above a price and below a document number nearly everywhere (ADR-0009).
    ("a long number", re.compile(r"\b\d{8,}\b")),
)


@dataclass(frozen=True, slots=True)
class Guarded:
    """A query after the guard: what may leave, and what was taken out of it."""

    #: What will actually be sent. Empty when nothing survived, and then
    #: nothing is sent at all.
    query: str
    #: In words the advisor can repeat to the traveler.
    removed: tuple[str, ...]


def guard(asked: str) -> Guarded:
    """What of this query may leave the application, and what was taken out.

    Every query goes through here, not only a suspicious one: the tidying and
    the length bound are part of it, so `Guarded.query` is always the whole of
    what was sent.
    """
    kept = asked
    removed: list[str] = []
    for kind, shape in _SHAPES:
        kept, found = shape.subn(" ", kept)
        if found and kind not in removed:
            removed.append(kind)

    kept = " ".join(kept.split())
    # A query that was a card number and a full stop must not go out as a
    # full stop.
    if not any(character.isalpha() for character in kept):
        kept = ""
    return Guarded(query=_shortened(kept), removed=tuple(removed))


def _shortened(query: str) -> str:
    """At most `MAX_QUERY` characters, cut at a word where there is one.

    No ellipsis, unlike a title: a search for three dots is a search for
    three dots.
    """
    if len(query) <= MAX_QUERY:
        return query
    return query[:MAX_QUERY].rsplit(" ", 1)[0]
