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
patterns in `privacy/queries.py`. A keyword rule was tried and rejected: "my passport
expires in 2027, do I need six months on it for Japan?" is the most ordinary passport
question there is, and anything keyed on the word guts it. The eight-digit threshold
over-reaches on purpose, and ADR-0009 says what it costs: a search for a hotel under ten
million rupiah loses the figure. A document number leaving is unrecoverable; a degraded
search is not.

**The first draft of that table had two real defects, and `/code-review` found both.**
Every pattern demanded contiguity, so `SSN 123 45 6789` and `AB-123456` slipped through;
and the mixed-alphanumeric pattern's lookahead was satisfied by pure digits, so a traveler
asking about ten million rupiah had the figure stripped *and* the advisor told, as trusted
fact, that their query had contained a document number. Those defects existed because
nothing exercised the table; there is now a row per pattern and a row per
ordinary-question-that-must-survive, each driven through a whole turn.

**The application's own account of a call sits outside the untrusted envelope.** Only what
came back from the web goes between the markers; which query was sent, and what the guard
took out of it, is the application speaking, and marking that never-an-instruction would
tell the advisor to disbelieve the one part of a result that is true by construction.

**`Citation.url` is nullable, and `Citation` carries the query.** A search that came back
citing nothing — or that did not come back — still leaves one Citation with the query on
it, because "what was actually sent is recorded" has to hold for a search that failed too.

**Criterion six is true by construction rather than by a rule.** The test drives the real
hole: a search result carrying a `SYSTEM OVERRIDE`, a canned model that *obeys* it, and
the assertion that both writes come back "there is no tool called that". Its teeth are the
offered-tools assertion, which pins the exact names, so the moment a writing tool joins
`LiveDataTools` the test goes red. **Whoever builds 09 and 11 owns keeping this true** —
which became ADR-0010.

**The search's cost is charged to the turn**, which the ticket did not ask for: the web
plugin is a flat $0.007 and `Message.cost_usd` documents itself as what the turn cost.

Checked by hand in the browser against the real web, with two visa questions through a
real key — the same hand check 07 relied on (`HANDOFF.md` §4).
