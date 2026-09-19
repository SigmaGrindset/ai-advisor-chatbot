# The search query guard strips document shapes rather than refusing the query

ADR-0004 puts the PII boundary at egress and notes that "the free-text search query is
validated". This records what that validation is.

The search query is the **only** free-text thing this application sends to a third party
other than the model itself — the other three Live-data Tools take coordinates and
standards-body codes. So it is guarded in one place: `privacy/queries.py`, called when a
search call is *read*, before the request exists.

The guard looks for **shapes**, not words: a card or account number in groups, an identity
number as 3-2-4 digits however separated, a passport number as a letter or two plus six to
nine digits (separated only when the letters are capitals), a passport number as eight to
twelve mixed alphanumerics with at least one letter, and any run of eight digits or more.
Each match is removed, the remainder bounded to 160 characters, and a query left with no
letters in it is refused outright. The patterns are mutually exclusive on purpose, because
the *name* of what was taken out is reported to the advisor as trusted fact — the mixed
pattern requires a letter precisely so a plain run of digits is called a long number
rather than a document number it is not.

Stripping rather than refusing the query, because "My passport is C12345678, do I need a
visa for Japan?" is a real question and refusing protects nobody — the number is already
in the Conversation and already went to the model. Shapes rather than nearby words,
because "my passport expires in 2027, do I need six months on it?" is the most ordinary
passport-validity question there is, and a keyword rule guts it.

Two consequences outlive the ticket. **The eight-digit threshold over-reaches
deliberately** — above a price in nearly every currency, below a document number in nearly
every country, but not all: a hotel under ten million rupiah loses the figure. A document
number leaving is unrecoverable; a degraded search is a worse search. And **what was
actually sent is recorded always**: the sent query rides on every Citation, including one
that cited nothing, which is why `Citation.url` is nullable.

**Nothing in a search result can cause a write** — not by a runtime rule, but because the
collection the loop offers contains only tools that fetch. ADR-0010 is what that became
once writing tools existed.
