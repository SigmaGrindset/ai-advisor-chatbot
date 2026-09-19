# 08: Web search and the query guard

**What to build:** A traveler asks whether they need a visa, and gets an answer drawn from
the current web with sources attached — and can see exactly what query left the machine to
get it.

**Blocked by:** 07.

**Status:** ready-for-agent

- [x] A web search tool exists, implemented as a nested request to OpenRouter with its web
      plugin enabled on the utility model; the answer and its source annotations return into
      the main loop as a tool result
- [x] The web plugin is never enabled on the main conversation request
- [x] Sources come back as Citations shown beneath the Message
- [x] Expanding a search Citation reveals the exact query that was sent
- [x] A query containing a passport-like, identity-like or card-like pattern is blocked or
      stripped before the request leaves the application, and what was actually sent is
      recorded
- [x] Nothing in a search result can cause a Traveler Profile write or a Trip Plan change on
      its own
- [x] Visa and entry questions reach for this tool rather than being answered from model
      knowledge
- [x] A test asserts the guard prevents a passport-like pattern from leaving
- [x] A test asserts a search result instructing the model to write to the Profile or Plan
      produces no write

## Comments

**The guard strips shapes, not words, and strips rather than refuses** — ADR-0009. Five
patterns in `privacy/queries.py`: a card or account number in groups, an identity number
as 3-2-4 digits however separated, a passport number as a letter or two plus six to nine
digits, a passport number as eight to twelve mixed alphanumerics (Germany issues those),
and any run of eight digits or more. A keyword rule was tried and rejected — "my passport
expires in 2027, do I need six months on it for Japan?" is the most ordinary passport
question there is, and anything keyed on the word guts it. A query left with no letters in
it is refused outright and no request is made. The eight-digit threshold over-reaches on
purpose, and ADR-0009 says what it costs: a search for a hotel under ten million rupiah
loses the figure. A document number leaving is unrecoverable; a degraded search is not.

**The first draft of that table had two real defects, and `/code-review` found both.**
Every pattern demanded contiguity, so `SSN 123 45 6789` and `AB-123456` slipped through
entirely. And the mixed-alphanumeric pattern's lookahead was satisfied by pure digits, so
every 8–12 digit run was claimed by it before "a long number" was reached: a traveler
asking about ten million rupiah had the figure stripped *and* the advisor told, outside
the untrusted envelope as trusted fact, that their query had contained a document number.
The mixed pattern now requires a letter, and the separated passport form is matched only
in capitals, so `AB 123456` is caught and `up to 1200000 VND` survives. Those defects
existed because nothing exercised the table; there is now a row per pattern and a row per
ordinary-question-that-must-survive, each driven through a whole turn.

**The application's own account of a call sits outside the untrusted envelope.** Only what
came back from the web goes between the markers; which query was sent, and what the guard
took out of it, is the application speaking, and marking that never-an-instruction would
tell the advisor to disbelieve the one part of a result that is true by construction.
`instructions.TOOL_GUIDANCE` draws that line. The three keyless tools are unchanged.

**`Citation.url` is nullable, and `Citation` carries the query.** A search that came back
citing nothing — or that did not come back — still leaves one Citation with the query on
it, because "what was actually sent is recorded" has to hold for a search that failed too.
That is the only reason the URL is nullable.

**Criterion six is true today by construction rather than by a rule**, and the test drives
the real hole: a search result carrying a `SYSTEM OVERRIDE` telling the advisor to save a
passport number, a canned model that *obeys* it and asks for `remember_profile_fact` and
`update_trip_plan`, and the assertion that both come back "there is no tool called that".
**Whoever builds 09 and 11 owns the rule that keeps this true** — a step answering tool
results must not be offered the writing collection. The review's fair objection was that
such a test passes by construction; the answer is the offered-tools assertion, which pins
the exact four names, so the moment a writing tool joins `LiveDataTools` the test goes
red. Said in ADR-0009, in the `LiveDataTools` docstring and in the test's own, rather than
built as an empty filter.

**The search's cost is charged to the turn, which the ticket did not ask for.** The web
plugin is a flat $0.007 and `Message.cost_usd` documents itself as what the turn cost, so
leaving out the most expensive part of it would have made that comment false.

Names the review sent back: `_unsourced` → `_pageless` (built from a word on Citation's
own `_Avoid_` line); a `Plan` type alias that would have sat beside 09's Trip Plan tools →
`Lookup`; `_and_ed` → `_in_words`. `CONTEXT.md` gains a **Search Query** entry, because
the query is on the traveler's screen and so is domain language. A third near-copy of
"shorten at a word" went away by deleting it — the status line carries the whole sent
query.

**Checked by hand in the browser, against the real web**, with two visa questions through
a real key: the status line naming the sent query, five numbered citation chips, and the
first expanding to its page title, URL and the query sent. Same hand check 07 relied on
(`HANDOFF.md` §4). Three Messages were left in the development database doing it.
