# The search query guard strips document shapes rather than refusing the query

ADR-0004 puts the PII boundary at egress and notes that "the free-text search query is
validated". This records what that validation is.

The search query is the **only** free-text thing this application sends to a third party
other than the model itself — the other three Live-data Tools take coordinates and
standards-body codes. So there is exactly one place to guard, and it is guarded in one
place: `privacy/queries.py`, called when a search call is *read*, before the request
exists.

The guard looks for **shapes**, not words: a card or account number in groups, an identity
number as 3-2-4 digits however separated, a passport number as a letter or two plus six to
nine digits (separated only when the letters are capitals), a passport number as eight to
twelve mixed alphanumerics with at least one letter, and any run of eight digits or more.
Each match is removed, the remainder bounded to 160 characters. The patterns are mutually
exclusive on purpose, because the *name* of what was taken out is reported to the advisor
as trusted fact — the mixed pattern requires a letter precisely so a plain run of digits
falls through and is called a long number rather than a document number it is not. A query
left with no letters in it is refused outright and no request is made.

## Considered Options

- **Refusing the whole query whenever a pattern matches.** Rejected: "My passport is
  C12345678, do I need a visa for Japan?" is a real question, and a refusal protects the
  traveler from nothing — the number is already in the Conversation and already went to
  the model, which ADR-0004 accepts as unavoidable. Stripping still stops it reaching a
  search engine, which is the third party that had no business seeing it.
- **Keying on nearby words** — strip numbers near "passport", "card", "SSN". Rejected: "my
  passport expires in 2027, do I need six months on it for Japan?" is the most ordinary
  passport-validity question there is, and a keyword rule guts it.
- **Redacting to a marker** rather than deleting. Rejected: a marker is a word the
  traveler did not search for.
- **Allowing a separator in the letter-and-digits pattern regardless of case.** Rejected:
  two-letter English words in front of a seven-digit price are commoner in travel queries
  than spaced passport numbers, and "up to 1200000 VND" must survive.
- **Trusting the model not to put a passport number in the query.** Rejected on principle:
  a boundary that depends on the thing it is bounding is not one. The Advisor Instructions
  do tell the model not to, which is a second line rather than the first.

## Consequences

**The shape table is tested as a table** — a row per pattern and a row per ordinary
question that must survive, each driven through a whole turn. Two real defects were in the
first draft, and both were things only a table would catch.

**The threshold over-reaches, deliberately.** Eight contiguous digits is above a price in
nearly every currency and below a document number in nearly every country, but not all: a
search for a hotel under ten million rupiah loses the figure. A document number leaving is
unrecoverable; a degraded search is a worse search. It is one number in one place if that
turns out wrong.

**What was actually sent is recorded, always.** The sent query rides on every Citation,
and a search that cited nothing — or did not come back — still leaves one with no link and
the query on it. This is why `Citation.url` is nullable. Only what came back from the web
goes between the untrusted markers: which query was sent is the application speaking, and
marking it never-an-instruction would tell the advisor to disbelieve the one part of a
result that is true by construction.

**Nothing in a search result can cause a write** — not by a runtime rule, but because the
collection the loop offers contains only tools that fetch. ADR-0010 is what that became
once writing tools existed.
