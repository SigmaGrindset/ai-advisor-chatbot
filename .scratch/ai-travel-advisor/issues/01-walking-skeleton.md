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

Implemented. Verified on this machine:

- `docker compose up` from a torn-down volume brings both services up; `app` waits on
  `db`'s health check. The check probes `127.0.0.1` rather than the Unix socket, so the
  temporary server the Postgres image runs during first-run `initdb` cannot satisfy it
  early.
- Schema application is `create_all` plus an `on conflict do nothing` insert of the sole
  Traveler, so a restart is a no-op. Covered by `tests/test_schema_application.py` and
  confirmed by restarting the container against an existing volume.
- The frontend is built with Node and served by the Python process from the same origin;
  there is no CORS configuration in the project. Any path the API does not claim resolves
  to the single-page application; `/api` and `/api/*` do not.
- The one outbound client is an `httpx2.AsyncClient`. Note that `openai` 3.x moved to
  `httpx2` (httpx 2.x under a new distribution name), so the application and the harness
  both use it — one client type, one seam.
- The harness (`tests/conftest.py`) drives the application over its own HTTP API against a
  real Postgres, each test inside a transaction that is rolled back, with the outbound
  client replaced by a transport that answers by host and refuses any unrouted host.
- Running without `OPENROUTER_API_KEY` starts normally, logs a warning, and reports
  `"openrouter_key": "missing"` from the health endpoint.

Two deliberate deviations from the spec's testing rules, both because ticket 01 has no
endpoint that reaches outward yet:

- `tests/test_outbound_seam.py` builds the model client directly rather than going through
  a route. It is the only way to assert criterion 6 before ticket 02 exists.
- `tests/test_schema_application.py` uses the database directly. It tests the startup
  path itself, which has no HTTP surface.

`tests/test_harness_isolation.py`, which asserted the harness's own rollback guarantee,
was removed later: it tested the fixtures rather than the application, and every test in
the suite now leans on that guarantee well enough to fail if it breaks.

Not done here, by design: the README's remaining six sections belong to ticket 15, and the
structured in-interface error for a missing key belongs to ticket 14.
