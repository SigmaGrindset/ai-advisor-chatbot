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

**The guard strips shapes, not words, and strips rather than refuses.** Recorded as
ADR-0009. Five patterns in `privacy/queries.py`: a card or account number written in
groups, an identity number as 3-2-4 digits however separated, a passport number as a letter
or two plus six to nine digits, a passport number as eight to twelve mixed alphanumerics
(Germany issues those), and any run of eight digits or more. A keyword rule was tried and
rejected — "my passport expires in 2027, do I need six months on it for Japan?" is the most
ordinary passport question there is, and anything keyed on the word "passport" guts it.
Stripping keeps that question answerable while the number still never reaches a search
engine. A query left with no letters in it is refused and no request is made at all.

**The first draft of that table had two real defects, and `/code-review` found both.**
Spaced and hyphenated forms slipped through entirely — `SSN 123 45 6789`, `AB-123456` —
because every pattern demanded contiguity. And the mixed-alphanumeric passport pattern's
lookahead was satisfied by pure digits, so every 8–12 digit run was claimed by it before
"a long number" was ever reached: a traveler asking about ten million rupiah had the figure
stripped *and* the advisor told, outside the untrusted envelope as trusted fact, that their
query had contained a document number. Both are fixed, and the fix for the second is that
the mixed pattern now requires a letter. The separated passport form is matched only when
the letters are capitals, so `AB 123456` is caught and `up to 1200000 VND` survives.

Those defects existed because nothing exercised the table. There is now a row per pattern
and a row per ordinary-question-that-must-survive, each driven through a whole turn.

The eight-digit threshold over-reaches on purpose, and ADR-0009 says what it costs: a
search for a hotel under ten million rupiah loses the figure. A document number leaving is
unrecoverable and a degraded search is not.

**The application's own account of a call now sits outside the untrusted envelope.** Only
what came back from the web goes between the markers; which query was sent, and what the
guard took out of it, is the application speaking. Marking that never-an-instruction would
be telling the advisor to disbelieve the one part of a search result that is true by
construction. `instructions.TOOL_GUIDANCE` was reworded to draw that line. The three
keyless tools are unchanged — everything in their results really did come from outside.

**`Citation.url` is now nullable, and `Citation` carries the query.** Each page a search
read becomes a Citation carrying the query that found it, which is what an opened chip
reveals. A search that came back citing nothing — or that did not come back at all — still
leaves one Citation, with no link and the query on it, because "what was actually sent is
recorded" has to hold for a search that failed too. That is the only reason the URL is
nullable.

**Criterion six is true today by construction rather than by a rule.** There is no tool
that writes to the Traveler Profile or the Trip Plan yet, and everything `LiveDataTools`
offers fetches. The test drives the real hole: a search result carrying a `SYSTEM OVERRIDE`
telling the advisor to save a passport number and change the destination, a canned model
that *obeys* it and asks for `remember_profile_fact` and `update_trip_plan`, and the
assertion that both come back "there is no tool called that", nothing is written, and no
step of the turn was ever offered anything but the four fetching tools. **Whoever builds
09 and 11 owns the rule that keeps this true** — a step answering tool results must not be
offered the writing collection. It is stated in ADR-0009 and in the `LiveDataTools`
docstring, and was deliberately not built as an empty filter today.

The review's fair objection was that such a test passes by construction and nothing fails
if the guarantee is later broken. The offered-tools assertion is the answer: it pins the
exact four names, so the moment 09 or 11 puts a writing tool into what `LiveDataTools`
offers, this test goes red. That is now said in the test's own docstring rather than left
to be noticed.

**The search's cost is charged to the turn, which the ticket did not ask for.** The web
plugin is a flat $0.007 and `Message.cost_usd` documents itself as what the turn cost, so
leaving the most expensive part of the turn out of it would have made that comment false.
`ToolResult` carries the nested call's usage and the loop adds it to the same running
total. One test covers it.

**Names the review sent back.** `_unsourced` was a Citation factory built from a word on
Citation's own `_Avoid_` list — now `_pageless`. A new type alias `Plan` for
`Errand | Search | Unusable` would have sat next to the Trip Plan tools ticket 09 brings
into this module — now `Lookup`, with the `plan` locals renamed with it. `_and_ed` needed
its docstring to mean anything — now `_in_words`. `CONTEXT.md` gains a **Search Query**
entry, because the query is on the traveler's screen and so is domain language rather than
an implementation detail. And a third near-copy of "shorten at a word" went away by
deleting it: the status line now carries the whole sent query, which is what the ticket is
about anyway.

**Checked by hand in the browser, against the real web.** Two visa questions through a
real OpenRouter key. The status line read "Searching the web for Do Croatian citizens need
a visa to visit Vietnam?…" while it ran; the answer came back citing Japan's Ministry of
Foreign Affairs and four other pages as five numbered chips; expanding the first showed the
page title, its URL, and "QUERY SENT — Do Croatian citizens need a visa to visit Japan for
tourism". The frontend suite is still Node-only with no rendering tests, so this is the
same hand check 07 relied on (see `HANDOFF.md` §4). Three Messages were left in the
development database doing it.
