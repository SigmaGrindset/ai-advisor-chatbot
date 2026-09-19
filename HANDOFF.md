# Handoff — orientation for the next agent

**Repo:** `D:\Antonio\ai-advisor-chatbot` · branch `main` · **no git remote**
**Current as of** ticket 11 (tickets 01–11 shipped; the advisor now calls Live-data
Tools, searches the web through a guarded query, leaves Citations behind, keeps a Trip
Plan that fills in beside the conversation as the traveler talks, and carries what it has
learned about the traveler from one Conversation into the next — and the traveler has a
page listing every Trip, can move a Conversation onto the right one, and can read and
delete everything that was learned about them).

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
- `docs/adr/0001`–`0012` — the decisions that are already made. 0004 (PII boundary) and
  0005 (hand-written tool loop) constrain the backend; 0008 amends 0003, because REST
  Countries stopped being keyless during 07; 0009 is the search query guard, and its last
  paragraph became **0010**, which 11's Traveler Profile writes now keep as well; 0001 is
  why the Traveler Profile is structured rather than retrieved, and the shape 11 gave it
  is in `CONTEXT.md` and ticket 11 rather than an ADR of its own;
  0002 (Trips own Trip Plans), 0006 (trip plan as a persistent pane) and 0007 (mobile as
  a first-class target) constrain the frontend, 0011 amends 0006 over what the peek on a
  phone actually is, and **0012 is what is allowed to be a page** — read it before 12 adds
  the second one.
- `docs/agents/` — the issue tracker, triage labels and domain-doc conventions.
- `.scratch/ai-travel-advisor/spec.md` and `issues/01`–`15` — the work. Each ticket carries
  a `**Status:**` line using the five canonical labels — a finished ticket keeps its label
  and records what happened in ticked boxes and a `## Comments` section, which is why the
  done ones still say `ready-for-agent`. 01–11 are done; 12–15 are unrun.

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
| `services/plans.py` | applying one Trip Plan change, and reading the plan back for the prompt, the wire and the Trips list | the plan's shape and the database |
| `services/profile.py` | applying one Traveler Profile change, and reading the profile back for the prompt and the wire | the profile's shape and the database |
| `advisor/` | `loop.py`, `tools.py`, `planning.py`, `remembering.py`, `calls.py`, `searching.py`, `prompt.py`, `client.py`, `instructions.py`, `titles.py` | the model, the plan's and profile's shapes and the keyless sources — no HTTP framework, no database, no browser |
| `db/` | `tables.py`, `connection.py`, `conversations.py`, `trips.py`, `traveler.py` | SQLAlchemy |
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
  the tool-call fragments it was sent, dispatches them through `advisor/tools.py`,
  `advisor/planning.py` or `advisor/remembering.py`, appends the results and re-calls
  until the model stops asking. `MAX_STEPS` is the runaway guard.
  A step is the last one when nothing accumulated, not when `finish_reason` says so —
  providers disagree about that. Every *fetched* tool result is wrapped in the
  untrusted-data delimiters named in `advisor/instructions.py`; a lookup that fails becomes
  the result rather than an exception, so the advisor explains it and the turn still
  completes. A plan tool's result is not wrapped: it is the application's own account of
  its own write, not something anyone told it.
- **Three tool catalogues, dispatched down three branches of that loop** — one fetches and
  never writes; the Trip Plan's and the Traveler Profile's write and never fetch.
  `loop.py::_offered` is where both writing collections leave the table for the rest of a
  turn the moment anything has been fetched into it, which is how ADR-0004's promise
  survives the existence of a writing tool (ADR-0010). Three tests hold it: the injection
  test in `test_web_search.py`, the Traveler Profile's own in `test_traveler_profile.py`,
  and `test_live_data_tools.py::test_nothing_that_writes_is_offered_once_something_has_been_fetched`.
  **Anything else that writes joins that side and inherits the rule.** The two writing
  catalogues share `advisor/calls.py` — what a tool looks like offered, how a call's
  arguments are read out of JSON, and what a short line or a whole number is — so each
  one holds only its own vocabulary. The Live-data Tools do not share it: a call that
  fetches is read into something that can be refused *before it is made* and carries what
  to tell the traveler while it runs.

### Frontend — `frontend/src/`

Vite, React 19, Tailwind v4, TypeScript strict.

```
main.tsx            imports design/base.css
App.tsx             composition, plus the Conversation, Trip and route state below it
api/                client.ts  types.ts
routes/             routing.ts  TripsPage.tsx
stream/             events.ts  useTurn.ts
components/
  shell/            AppFrame.tsx  AppShell.tsx  Sheet.tsx
                    dragging.ts  layout.ts  snapping.ts  viewport.ts
  conversation/     ConversationPane  ConversationList  Composer  Prose  Citations
                    markdown.ts  announcing.ts  following.ts  firstRun.ts  conversationName.ts
  plan/             PlanPanel  EditableField  PlanPeek
                    holding.ts  merging.ts  fields.ts  dates.ts  money.ts
                    highlighting.ts  questionPrompt.ts
  trip/             TripChip  TripSwitcher  naming.ts  listing.ts
  profile/          ProfilePanel  listing.ts
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
- **`components/plan/holding.ts` holds the Trip Plan, and `merging.ts` is the rule it
  applies.** Two writers reach one plan — the advisor mid-turn, the traveler by hand — and
  what happens when they reach for the same field is a decision, so it is pure and tested
  on its own. The field under edit keeps the traveler's value, the rest of the patch lands,
  and what the advisor wanted is offered underneath as a suggestion. Which field is under
  edit lives in a ref, because nothing on the page is drawn from it.
- **`routes/routing.ts` is the whole router** (ADR-0012): two addresses in a `PATHS` literal, read
  out of `window.location` and pushed onto the history, with `useRoute` subscribing to
  `popstate` and to a custom event `pushState` fires in its place. Ticket 12's Advisor
  Instructions page is one more entry. The state every screen needs lives in `App.tsx`
  *above* the route, so navigating does not take a running turn down with it, and
  `AppFrame` is the one fixed, keyboard-aware window both screens are drawn in.
- **The Traveler Profile is held in `App.tsx` beside the Trips**, and for the same kind of
  reason: it belongs to no Conversation, every one of them is shown it, and any one of them
  can add to it mid-turn. `profile_revised` is the turn event that carries it, whole.
  `RecordPane`'s `unseen` is a set of tabs rather than a boolean about the plan, so either
  record can be marked as changed while the traveler reads the other.

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

After ticket 11: **103 frontend tests in 15 files** (~1s), `tsc` silent, build clean; **93
backend tests**, mypy clean over 52 files. Confirm those numbers *before* you start — if
they do not match, something changed underneath you. Update this paragraph when a ticket
legitimately moves them.

09, 10 and 11 are the tickets that moved the frontend suite, because each brought pure
modules with opinions in them: 09's merge rule, field readings and calendar, 10's three —
which page an address names, what a Trip is called when nobody has named one, and what
becomes of the Trips list when a plan arrives — and 11's one, the order the Traveler
Profile reads in. What draws them is still `.tsx` the Node-only suite does not reach, and
was checked by hand.

**The schema is applied at startup and never altered**, so a database left over from an
earlier ticket has none of 09's `trip`, `itinerary_item` or `open_question` tables, no
`conversation.trip_id`, and none of 11's `profile_fact` table or `traveler.next_fact_ref`
column. `docker compose down -v` before verifying by hand. `create_all` *does* add a
missing table, so 11 against an existing database needs only the column:
`alter table traveler add column if not exists next_fact_ref integer not null default 1`.
(10 added nothing, so a database that has been through 09 and 11 needs nothing more.)

**Vite proxies to `http://localhost:8000`, which resolves to `[::1]` first here.** A
backend started with `--host 127.0.0.1` is invisible to it and every `/api` call comes back
500 through the dev server. Start it with `--host ::`. That socket is **IPv6-only** on this
machine — Vite reaches it because `localhost` resolves to `[::1]` first, but a `curl
http://localhost:8000/...` of your own is refused outright. Use `curl "http://[::1]:8000/..."`
when checking the API by hand.

**Check which process owns port 8000, not only that one is listening.** A dev server left
over from ticket 08 was still serving old code on `[::1]:8000` while a freshly started one
bound `127.0.0.1:8000`; `localhost` resolves to the IPv6 address first here, so curl and
Vite's proxy both reached the stale one and the Trip Plan never appeared. Its `--reload`
parent was already dead and its worker still held the socket. `netstat -ano | grep :8000`,
then check the PID is the one you started. This is the deeper version of the note that used
to live here: a `--reload` server does not pick up new modules either.

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
  `apply_schema()` at startup. Undecided, and 09 made it cost something: `create_all`
  creates what is missing and alters nothing, so adding `conversation.trip_id` meant
  `docker compose down -v`. Every later ticket that touches the schema pays the same
  price, and the evaluator pays it too if they run an image from before the change.
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
