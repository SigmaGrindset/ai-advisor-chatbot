# 08: Web search and the query guard

**What to build:** A traveler asks whether they need a visa, and gets an answer drawn from
the current web with sources attached — and can see exactly what query left the machine to
get it.

**Blocked by:** 07.

**Status:** ready-for-agent

- [ ] A web search tool exists, implemented as a nested request to OpenRouter with its web
      plugin enabled on the utility model; the answer and its source annotations return into
      the main loop as a tool result
- [ ] The web plugin is never enabled on the main conversation request
- [ ] Sources come back as Citations shown beneath the Message
- [ ] Expanding a search Citation reveals the exact query that was sent
- [ ] A query containing a passport-like, identity-like or card-like pattern is blocked or
      stripped before the request leaves the application, and what was actually sent is
      recorded
- [ ] Nothing in a search result can cause a Traveler Profile write or a Trip Plan change on
      its own
- [ ] Visa and entry questions reach for this tool rather than being answered from model
      knowledge
- [ ] A test asserts the guard prevents a passport-like pattern from leaving
- [ ] A test asserts a search result instructing the model to write to the Profile or Plan
      produces no write
