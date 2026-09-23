# 01: Walking skeleton and test harness

**Status:** closed

`docker compose up` starts Postgres and the app, applies the schema at startup, and serves
the frontend from the same origin with no CORS. Every outbound call goes through one
injectable HTTP client, which is the test seam: tests call the app's own API against real
Postgres, with canned responses routed by host. A missing OpenRouter key logs a warning
instead of stopping startup.
