# 01: Walking skeleton and test harness

**What to build:** Someone with a clean machine and a checkout runs one command and gets a
working — if empty — application: the browser loads a page served by the application
service, the database is up with its schema already applied, and a health endpoint reports
both are alive. This ticket also lays the single test seam every later ticket builds on, so
no later ticket has to invent one.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] `docker compose up` from a clean checkout brings up a Postgres service and one
      application service; the application waits on the database's health check rather than
      racing it
- [x] The schema is applied automatically at startup before traffic is accepted, and a
      restart neither reapplies it nor fails
- [x] The browser loads the built frontend from the application service on a single origin;
      there is no CORS configuration anywhere in the project
- [x] An unknown client-side path resolves to the single-page application rather than a 404
- [x] A health endpoint reports application and database status
- [x] Every outbound HTTP call in the application resolves through one injectable client
      dependency, including the model client
- [x] The test harness drives the application through its own HTTP API against a real
      Postgres instance, each test in a rolled-back transaction, with the outbound client
      replaced by a transport that routes canned responses by host
- [x] At least one test passes through that harness
- [x] A missing OpenRouter key does not prevent the application from starting

## Comments

Verified on this machine: `docker compose up` from a torn-down volume, a restart against
an existing volume, and a start with no `OPENROUTER_API_KEY` — which warns and reports
`"openrouter_key": "missing"` rather than refusing to boot.

- The one outbound client is an `httpx2.AsyncClient`: `openai` 3.x moved to `httpx2`
  (httpx 2.x under a new distribution name), so the application and the harness share one
  client type and one seam.
- The database health check probes `127.0.0.1` rather than the Unix socket, so the
  temporary server the Postgres image runs during first-run `initdb` cannot satisfy it.
- `test_outbound_seam.py` and `test_schema_application.py` reach past the HTTP seam, the
  only way to assert their criteria before anything reaches outward; both say so in their
  docstrings. `test_harness_isolation.py` was removed later — it tested the fixtures
  rather than the application.

Not done here, by design: the README's remaining six sections are 15's, and the
structured in-interface error for a missing key is 14's.
