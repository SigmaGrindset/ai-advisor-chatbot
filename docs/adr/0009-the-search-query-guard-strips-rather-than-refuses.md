# The search query guard strips document shapes rather than refusing the query

ADR-0004 puts the PII boundary at egress and notes that "the free-text search query is
validated". This records what that validation actually is.

The web search query is the **only** free-text thing this application sends to a third
party other than the model itself. The other three Live-data Tools take coordinates and
standards-body codes, which a traveler's words cannot fit into. So there is exactly one
place to guard, and it is guarded in exactly one place: `privacy/queries.py`, called from
`advisor/tools.py` when a search call is *read* — before the `Search` that would make the
request even exists.

The guard looks for **shapes**, not for words. Five patterns: a payment card or account
number written in groups of three digits or more; a national identity number as three,
two and four digits however separated; a passport number as a letter or two and six to nine
digits, separated only when the letters are capitals; a passport number as eight to twelve
mixed letters and digits with at least two digits and at least one letter among them; and
any run of eight digits or more. Each match is removed, the remainder is tidied and bounded
to 160 characters, and the result is what gets sent.

The order matters and the patterns are mutually exclusive on purpose, because the *name* of
what was taken out is reported to the advisor as trusted fact. The mixed-alphanumeric
passport pattern requires a letter precisely so that a plain run of digits falls through to
the last shape and is called a long number rather than a document number it is not.

A query left with no letters in it — one that was a document number and nothing else — is
refused outright and no request is made.

## Considered Options

- **Refusing the whole query whenever a pattern matches.** Rejected. "My passport is
  C12345678, do I need a visa for Japan?" is a real question with a real answer, and a
  traveler who gets a refusal instead of an answer has been protected from nothing — the
  number is already in the Conversation and already went to the model, which ADR-0004
  accepts as unavoidable. Stripping keeps the question answerable and still stops the number
  reaching a search engine, which is the third party that had no business seeing it.
- **Keying on nearby words** — strip numbers that appear near "passport", "card", "SSN".
  Rejected: "my passport expires in 2027, do I need six months on it for Japan?" is the most
  ordinary passport-validity question there is, and a keyword rule guts it. Shapes are both
  narrower and better targeted.
- **Redacting to a marker** (`[removed]`) rather than deleting. Rejected: the query goes to
  a search engine, and a marker is a word the traveler did not search for.
- **Allowing a separator in the letter-and-digits passport pattern regardless of case**
  (`AB 123456` and `to 1200000` alike). Rejected: two-letter English words in front of a
  seven-digit price are far commoner in travel queries than spaced passport numbers, and
  "up to 1200000 VND" must survive. Requiring capitals for the separated form keeps both.
- **Trusting the model not to put a passport number in the query.** Rejected on principle —
  this is the boundary, and a boundary that depends on the thing it is bounding is not one.
  The Advisor Instructions do tell the model not to, which is a second line rather than the
  first.

## Consequences

**The shape table is tested as a table.** Every pattern has a row in
`tests/test_web_search.py`, driven through a whole turn, asserting both what reaches the
search and what the advisor is told was taken out — and rows for the ordinary travel
questions that must survive untouched. Two real defects were in the first draft of this
table (spaced forms slipping through, and plain digit runs being reported as document
numbers), and both were things only a table would catch.

**The threshold over-reaches, deliberately.** Eight contiguous digits is above a price in
nearly every currency and below a document number in nearly every country, but not all:
a traveler searching for a hotel under ten million rupiah has the figure taken out of their
search, and gets an answer about hotels rather than about that price. A document number
leaving is unrecoverable; a degraded search is a worse search. The threshold sits where it
does for that asymmetry, and it is one number in one place if that turns out wrong.

**What was actually sent is recorded, always.** The sent query rides on every Citation the
search leaves, so a traveler expanding one reads the exact words that left the machine
rather than the ones the advisor asked to send. A search that came back citing no page —
or that did not come back at all — still leaves a single Citation with no link and the
query on it, because a search that happened has to be accountable whether or not it
worked. This is why `Citation.url` is nullable.

**The application's own account of the call sits outside the untrusted envelope.** Only
what came back from the web goes between the markers. Which query was sent, and what the
guard took out of it, is the application speaking, and marking that never-an-instruction
would tell the advisor to disbelieve the one part of a search result that is true by
construction.

**Nothing in a search result can cause a write.** Not because a rule says so at runtime,
but because the collection of tools the loop offers contains only tools that fetch. The
Traveler Profile writes (ticket 11) and the Trip Plan changes (ticket 09) arrive as a
separate collection, and the rule that keeps ADR-0004's promise is that a step answering
tool results is never offered that collection. Whoever builds those tools owns that rule —
it is the reason `LiveDataTools` says in its own docstring that everything in it fetches.

There is a tripwire rather than only a note. The test named
`test_a_search_result_telling_the_advisor_to_write_produces_no_write` asserts the exact set
of tool names offered on every step of a turn, so the moment a writing tool joins that set
the test fails and sends whoever added it back to this paragraph.
