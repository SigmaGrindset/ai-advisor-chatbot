# AI Advisor Chatbot — <your name>

> Replace this file's placeholder sections with your own content as you work.
> These seven sections are required (the last one optional) — see TASK.md for details.

## 1. Setup & run

Prerequisite: Docker with Compose v2.

```
cp .env.example .env    # then put your OpenRouter key in it
docker compose up
```

The application is on <http://localhost:8000>. The schema is applied at startup, so
there is no migration step. The application starts without an OpenRouter key and
reports the key as missing at `/api/health`; the advisor cannot answer until one is
supplied.

If ports 8000 or 5432 are taken, set `APP_PORT` or `DB_PORT` in `.env`.

### Running the tests

The tests need a real Postgres and a Python environment:

```
docker compose up -d db
python -m venv .venv
.venv/bin/pip install -e "./backend[dev]"      # Windows: .venv/Scripts/pip
cd backend && ../.venv/bin/python -m pytest    # Windows: ../.venv/Scripts/python
```

They use their own `travel_advisor_test` database, created on first run. Point them
elsewhere with `TEST_DATABASE_URL`.

## 2. Architecture overview

<!-- The main parts of your app and how they fit together. A diagram is welcome but not required. -->

## 3. Key decisions

<!-- What you chose for the important open questions (e.g. how conversations are
stored, how the bot's behavior is managed) and what alternatives you considered. -->

## 4. Ambiguities

<!-- Anything in the requirements that was unclear or seemed to pull in different
directions, and the call you made. -->

## 5. AI usage

<!-- How you used Claude Code while building: which techniques (planning, subagents,
anything beyond plain chatting), where, and why. -->

## 6. Known limitations

<!-- What doesn't work well, wasn't handled, or would need attention before real use.
Every project has these; we want to see that you know yours. -->

## 7. Beyond the spec (optional)

<!-- Anything you built beyond the requirements. -->
