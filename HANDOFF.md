# Handoff — orientation for the next agent

**Repo:** `D:\Antonio\ai-advisor-chatbot` · branch `main` · **no git remote**
**Current as of** ticket 08 (tickets 01–08 shipped; the advisor now calls Live-data
Tools, searches the web through a guarded query, and leaves Citations behind).

This is the standing orientation for anyone picking up work here: how the application is
put together, what binds the names you write, how this repo is worked in, and what is
known to bite on this machine. It is not a task — the task is a ticket.

---

## 1. Read these first

- `CLAUDE.md` — project rules. The prompt log and the commit rule are in here.
- `CONTEXT.md` — the domain glossary. **Every term carries an `_Avoid_` list, and those
  lists bind file, module and component names.** See §3.
- `TASK.md` and `README.md` — what was asked for, and how to run it. README §2–7 are still
  placeholders and are part of the deliverable.
- `docs/adr/0001`–`0009` — the decisions that are already made. 0004 (PII boundary) and
  0005 (hand-written tool loop) constrain the backend; 0008 amends 0003, because REST
  Countries stopped being keyless during 07; 0009 is the search query guard, and its last
  paragraph is a rule **09 and 11 have to keep**; 0006 (trip plan as a persistent
  pane) and 0007 (mobile as a first-class target) constrain the frontend.
- `docs/agents/` — the issue tracker, triage labels and domain-doc conventions.
- `.scratch/ai-travel-advisor/spec.md` and `issues/01`–`15` — the work. Each ticket carries
  a `**Status:**` line using the five canonical labels. 01–08 are done; 09–15 are unrun.

---

## 2. How the application is put together

One origin. FastAPI serves both `/api/*` and the built Vite bundle, so there is no CORS
configuration anywhere and a client-side route survives a reload (`app/frontend.py`).
Postgres holds everything; the schema is applied at startup, so there is no migration step.

### Backend — `backend/app/`

| Layer | Holds | Knows about |
|---|---|---|
| `api/` | routes and the SSE wire format | HTTP, and `services/` |
| `services/turns.py` | one turn end to end: drives the loop, records what comes back, names the Conversation | the loop and the database, not the wire |
| `advisor/` | `loop.py`, `tools.py`, `searching.py`, `prompt.py`, `client.py`, `instructions.py`, `titles.py` | the model and the keyless sources — no HTTP framework, no database, no browser |
| `db/` | `tables.py`, `connection.py`, `conversations.py` | SQLAlchemy |
| `privacy/` | `outbound.py` (the single injectable HTTP client every outbound call leaves through) and `queries.py` (the guard on the one free-text thing that leaves) | nothing above it |
| `config.py`, `frontend.py`, `main.py` | settings, static serving, composition | everything, by construction |

Dependencies point one way: `api → services → advisor`/`db`. Nothing below reaches back
up. This is **not** enforced by a test, deliberately — see §4.

Three seams do most of the design work, and new features should join them rather than go
around them:

- **`services/turns.py` yields what happened, not what to send.** The wire format stays in
  `api/`, so a tool call or a Trip Plan patch can be added to a turn without the HTTP
  response shape being decided in the service.
- **`privacy/` is the one egress, and the one check on it.** The model client and every
  Live-data Tool take `outbound.py`'s client as a dependency; tests swap in a transport that
  answers by host, which is what keeps real request-building and response-parsing under test
  (ADR-0004). `queries.py` is the other half: the web search query is the only free text this
  application sends to a third party, so it is read for document-number shapes before the
  plan that would send it even exists (ADR-0009).
- **The tool loop is ours** (`advisor/loop.py`, ADR-0005). It streams a step, accumulates
  the tool-call fragments it was sent, dispatches them through `advisor/tools.py`, appends
  the results and re-calls until the model stops asking. `MAX_STEPS` is the runaway guard.
  A step is the last one when nothing accumulated, not when `finish_reason` says so —
  providers disagree about that. Every tool result is wrapped in the untrusted-data
  delimiters named in `advisor/instructions.py`; a lookup that fails becomes the result
  rather than an exception, so the advisor explains it and the turn still completes.

### Frontend — `frontend/src/`

Vite, React 19, Tailwind v4, TypeScript strict.

```
main.tsx            imports design/base.css
App.tsx             composition, plus the Conversation state the list and the pane share
api/                client.ts  types.ts
stream/             events.ts  useTurn.ts
components/
  shell/            AppShell.tsx  Sheet.tsx  dragging.ts  layout.ts  snapping.ts  viewport.ts
  conversation/     ConversationPane  ConversationList  Composer  Prose  Citations
                    markdown.ts  announcing.ts  following.ts  firstRun.ts  conversationName.ts
  record/           RecordPane.tsx
design/             tokens.css  base.css  icons.ts  tripPastel.ts
```

- **`stream/useTurn.ts` owns the only thing that unfolds over time.** A reply arrives a
  fragment at a time, may be stopped part-written, may fail, and may start and name a
  Conversation on the way. Holding that in one place is what lets everything that *shows* a
  turn stay a component that draws what it is handed. The draft lives there too, because it
  is the turn before it is one.
- **`App.tsx` holds the Conversation state** because a turn both appends a Message to the
  open Conversation and moves its row to the top of the list; two copies would disagree.
- **`stream/events.ts` is the whole mid-turn vocabulary** — the union of what the server can
  say while a turn runs. Anything new a turn can report is a member of that union. 07 added
  `consulting` and `consulted`, which is what the status line above a forming reply is
  driven by; `api/conversations.py::_as_event` is exhaustive on purpose, so a new one fails
  the backend type check rather than reaching the browser unnamed.
- **`api/client.ts` reads SSE with a stream reader, not `EventSource`**, because a turn is a
  POST. Aborting the signal is the only way to stop a reply.
- **Where deferred work lands:** `components/plan/` (ticket 09), `components/profile/`
  (ticket 11), `routes/` (ticket 10 — there is no router in the project yet). Do not create
  these folders before the ticket that fills them.

---

## 3. Naming is bound by the glossary

`CONTEXT.md` gives each domain term an `_Avoid_` list. Check every name you are about to
write against it — this has been violated and undone more than once. The cases that keep
coming up:

- **Chat / session / thread → `Conversation`.** The folder is `conversation/`.
- **Memory / user data / context → `Traveler Profile`.** There is no `context.*` and no
  `memory/` anywhere; a backend `context.py` was renamed `prompt.py` for exactly this.
- **Assistant / bot / agent / AI → `Advisor`.**
- **No message bubbles.** Ticket 05 made advisor replies full-width prose on purpose; there
  is no `MessageBubble`.
- **No `components/ui/`** — `design/` already is the visual system. **No `lib/utils.ts`** —
  modules are named for what they do (`announcing`, `following`, `snapping`).
- **No `tailwind.config.ts`.** Tailwind v4: the `@theme static` block in `design/tokens.css`
  is the whole visual system, by decision in ticket 04.

---

## 4. Working rules for this repo

**Never run `git add`, `git commit` or any other git write on your own.** `CLAUDE.md` says
so and the user has repeated it. Propose the message, wait for explicit approval. When a
commit does happen, `PROMPTS.jsonl` goes in the *same* commit as the code, so the log and
the history stay in sync.

**Commit messages are short**: a one-line subject and at most a few tight paragraphs, in
the style already in `git log`.

**`PROMPTS.jsonl` is never edited, rewritten or truncated**, and the two logging hooks in
`.claude/settings.json` stay enabled. If the log stops growing, repair the mechanism.

### The testing rule

> Keep tests that test functionality and whether the app works as expected. Delete tests
> that exist only to confirm the code is shaped the way we said.

This line has cost two test suites already — the backend's `test_layering.py` and the
frontend's design suite (`sources.ts`, `wcag.ts` and their tests) were both written and
then deleted under it. What follows from it:

- Do not write tests that assert folder structure, import direction, naming or code style.
  If import direction is ever worth enforcing, it belongs in a lint config.
- A restructure's proof is that the existing suite still passes, not a new test describing
  the tree.
- A test that reads source files is only justified when it asserts a fact a traveler could
  hit. One survives: `components/shell/layout.test.ts` reads `design/tokens.css` to check
  that the breakpoints in the theme and the breakpoints in the shell are the same two
  numbers. If either file moves, fix that `new URL(...)`.

### What the suites are

- **Frontend:** vitest in a plain Node environment (`environment: "node"`,
  `include: ["src/**/*.test.ts"]`, `TZ` fixed to UTC). Pure modules only — there are no
  rendering tests today, and `.tsx` files are not matched by the include pattern.
- **Backend:** pytest against a **real Postgres**. `docker compose up -d db` first. The
  tests use their own `travel_advisor_test` database, rebuilt from the model on every run.

---

## 5. Verification

Run all four. Whichever half you changed, the other one proves you did not reach into it.

```bash
cd D:/Antonio/ai-advisor-chatbot/frontend && npx tsc --noEmit && npm test && npm run build
```

```bash
cd D:/Antonio/ai-advisor-chatbot/backend && D:/Antonio/ai-advisor-chatbot/.venv/Scripts/python.exe -m pytest -q
```

```bash
cd D:/Antonio/ai-advisor-chatbot/backend && D:/Antonio/ai-advisor-chatbot/.venv/Scripts/python.exe -m mypy
```

After ticket 08: **56 frontend tests in 7 files** (~1s), `tsc` silent, build clean; **64
backend tests**, mypy clean over 40 files. Confirm those numbers *before* you start — if
they do not match, something changed underneath you. Update this paragraph when a ticket
legitimately moves them.

The backend suite grew and the frontend's did not, twice running, which is the shape of
both 07 and 08: the loop, the tools, the guard and the wire format are all testable through
the API, and the status line and the Citation chips are `.tsx` that the Node-only frontend
suite does not reach. They were checked by hand against real lookups and a real web search
instead.

**A dev server left running with `--reload` did not pick up ticket 08's new modules.** If
you are verifying by hand and the advisor says it cannot do the thing you just built,
restart it rather than believing it.

---

## 6. Machine notes (Windows)

- **The virtualenv is at the repo root**, `D:\Antonio\ai-advisor-chatbot\.venv`, *not* under
  `backend/`. A bare `python -m pytest` fails with "No module named pytest" — use the full
  interpreter path above.
- **Heredocs on this machine eat a level of backslashes.** Writing a file that contains
  regexes via `python - <<'PY'` mangles `\d`, `\[`, `\n`. Use the `Write` tool for any file
  with a regex or a Windows path in it.
- **Paths are case-insensitive**: a module named `sheet.ts` beside `Sheet.tsx` collides.
  That is why the pure modules beside a component get their own names (`snapping.ts`).
- **The built-in browser pane renders the app**, but changing the emulated viewport fires
  neither `resize` nor a `matchMedia` change, so breakpoint *transitions* cannot be driven
  there. Load the page at a width instead.
- Running it: `docker compose up`, then <http://localhost:8000>. `APP_PORT` / `DB_PORT` in
  `.env` if those ports are taken. The app starts without an OpenRouter key and reports it
  missing at `/api/health`; the advisor cannot answer until one is supplied. A database left
  over from an earlier schema is not migrated — `docker compose down -v`.

---

## 7. Open questions — raise these, do not decide them alone

- **`db/migrations/`.** Raw SQL plus numbered migrations, versus the current SQLAlchemy
  `apply_schema()` at startup. Undecided.
- **The unrouted-host assertion.** `backend/tests/fakes/canned_transport.py` still raises
  `UnroutedHost`, but nothing asserts it any more, and ADR-0004 puts the PII boundary
  precisely at egress to third parties. The user has been told. The original is in
  `git show cefc2ca:backend/tests/test_outbound_seam.py`.
- **Ticket 06's last acceptance criterion** — verification on a real phone — is unticked and
  marked `ready-for-human`. It needs the user, not an agent.

---

## 8. Skills worth calling

- **`codebase-design`** before deciding where a seam or a split lands. It carries the
  deep-module vocabulary the rest of this codebase was designed with.
- **`code-review`** at the end of a piece of work, with the commit you started from as the
  fixed point and the ticket as the spec. It is a two-axis review (standards + spec).
- Skip **`tdd`** for work that introduces no new behaviour — a relocation or a rename has
  nothing to write a failing test against, and §4 warns against writing one anyway.
