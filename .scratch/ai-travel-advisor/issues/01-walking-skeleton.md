# 01: Walking skeleton and test harness

**What to build:** Someone with a clean machine and a checkout runs one command and gets a
working — if empty — application: the browser loads a page served by the application
service, the database is up with its schema already applied, and a health endpoint reports
both are alive. This ticket also lays the single test seam every later ticket builds on, so
no later ticket has to invent one.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `docker compose up` from a clean checkout brings up a Postgres service and one
      application service; the application waits on the database's health check rather than
      racing it
- [ ] The schema is applied automatically at startup before traffic is accepted, and a
      restart neither reapplies it nor fails
- [ ] The browser loads the built frontend from the application service on a single origin;
      there is no CORS configuration anywhere in the project
- [ ] An unknown client-side path resolves to the single-page application rather than a 404
- [ ] A health endpoint reports application and database status
- [ ] Every outbound HTTP call in the application resolves through one injectable client
      dependency, including the model client
- [ ] The test harness drives the application through its own HTTP API against a real
      Postgres instance, each test in a rolled-back transaction, with the outbound client
      replaced by a transport that routes canned responses by host
- [ ] At least one test passes through that harness
- [ ] A missing OpenRouter key does not prevent the application from starting
