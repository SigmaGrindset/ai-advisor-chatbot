"""The one free-text thing that leaves this application, read before it does.

Three of the Live-data Tools take arguments a traveler's words cannot fit into:
two coordinates, two currency codes, a country code. The fourth is a web search,
and a search needs a question in words — so this is the single place where free
text crosses the boundary ADR-0004 draws, and so it is the single place that
text is looked at before it crosses.

What is looked for is not "personal data", which is not a thing a regular
expression can find. It is the handful of *shapes* a document number takes: a
payment card written out in its groups, a national identity number, a passport
number, and the long run of digits all of those are once their punctuation is
dropped. Shapes rather than nearby words, because "my passport expires in 2027,
do I need six months on it for Japan?" is a question the traveler should get an
answer to, and a rule keyed on the word "passport" would gut it.

A query carrying one of those shapes has the shape taken out and goes on
without it; a query that was nothing but one is refused, because a search for
nothing is not a search. Stripping rather than refusing outright is deliberate
(ADR-0009): a traveler who mentions their passport number while asking whether
they need a visa still has a visa question, and the useful thing to do with it
is to answer it.
"""

import re
from collections.abc import Sequence
from dataclasses import dataclass

#: How long a query may be. A search is a question, not a paragraph — and prose
#: is exactly where a traveler's whole situation would travel, so the query is
#: bounded before anything else is done with it.
MAX_QUERY = 160

#: The shapes a document number takes, each with what to call it in words.
#:
#: Tried in this order and each one replaced where it is found, so the widest
#: net is cast last and what gets reported is the most specific thing that
#: matched rather than "a long number" every time.
_SHAPES: Sequence[tuple[str, re.Pattern[str]]] = (
    # A payment card or an account number, written in the groups people write
    # them in. Three digits to a group at least, which is what keeps a date
    # range — "15 03 2026", "2026-03-15 - 2026-03-22" — from being one of these.
    ("a payment card or account number", re.compile(r"\b\d{3,}(?:[ \-]\d{3,}){2,}\b")),
    # The one national identity number with a shape of its own, written with
    # either of the separators people write it with.
    ("a national identity number", re.compile(r"\b\d{3}[ \-]\d{2}[ \-]\d{4}\b")),
    # A passport number as most countries issue one: a letter or two, then six
    # to nine digits. Separated only when the letters are capitals, because
    # "AB 123456" is a document number and "up to 1200000" is a budget.
    (
        "a passport or document number",
        re.compile(r"\b(?:[A-Za-z]{1,2}\d{6,9}|[A-Z]{1,2}[ \-]\d{6,9})\b"),
    ),
    # And as the rest issue one — Germany's "C01X00T47" — letters and digits
    # mixed, eight to twelve of them, with at least two digits among them. A
    # year, a flight number or a room count is shorter than that or carries one
    # run of digits rather than two. A letter is required, so that a plain run
    # of digits falls through to the last shape and is called what it is.
    (
        "a passport or document number",
        re.compile(
            r"\b(?=[A-Za-z0-9]{8,12}\b)(?=(?:[A-Za-z]*\d){2})(?=[A-Za-z0-9]*[A-Za-z])"
            r"[A-Za-z0-9]+\b"
        ),
    ),
    # And what every one of the above is once its punctuation is dropped. Eight
    # digits is above a price and below a document number nearly everywhere;
    # ADR-0009 records what the "nearly" costs.
    ("a long number", re.compile(r"\b\d{8,}\b")),
)


@dataclass(frozen=True, slots=True)
class Guarded:
    """A query after the guard: what may leave, and what was taken out of it."""

    #: What will actually be sent. Empty when what was taken out was all there
    #: was, and then nothing is sent at all.
    query: str
    #: What kinds of thing were taken out, in words the advisor can repeat to
    #: the traveler. Empty when the query went through untouched.
    removed: tuple[str, ...]


def guard(asked: str) -> Guarded:
    """What of this query may leave the application, and what was taken out.

    Every query goes through here, not only a suspicious one: the tidying and
    the length bound are part of it, so `Guarded.query` is always the whole of
    what was sent and there is no second path a query could take out.
    """
    kept = asked
    removed: list[str] = []
    for kind, shape in _SHAPES:
        kept, found = shape.subn(" ", kept)
        if found and kind not in removed:
            removed.append(kind)

    kept = " ".join(kept.split())
    # Nothing but digits and punctuation left is nothing to search for. A query
    # that was a card number and a full stop must not go out as a full stop.
    if not any(character.isalpha() for character in kept):
        kept = ""
    return Guarded(query=_shortened(kept), removed=tuple(removed))


def _shortened(query: str) -> str:
    """At most `MAX_QUERY` characters, cut at a word where there is one.

    No ellipsis, unlike a title: this is going to a search engine rather than
    onto a page, and a search for three dots is a search for three dots.
    """
    if len(query) <= MAX_QUERY:
        return query
    return query[:MAX_QUERY].rsplit(" ", 1)[0]
