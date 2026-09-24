# Handoff — orientation for the next agent

**Repo:** `D:\Antonio\ai-advisor-chatbot` · branch `main` · **no git remote**

**Where things stand:** tickets 01–14 and 16 are shipped. **15 is the only one unrun** —
the README's remaining sections, the audit pass and the verification sweep. 06's last
criterion (a pass on a real phone) and 16's wording check both need a human.
In `.scratch/accounts-and-guests/`, 01–06 are shipped: whoever writes something is a Guest
of their own, swept a day after their last request (`services/sweep.py`, hourly from the
lifespan), the frontend can run on a host of its own, and a Traveler can sign in through
Clerk and find their work in any browser. A Guest who signs up keeps the visit; one who
signs in to an Account they already have is warned, then leaves it behind. Still to come:
Clerk's screens in the application's own look (07), and the two deletions (08).

The advisor fetches live data rather than guessing, searches the web through a guarded
query, keeps a Trip Plan that fills in beside the conversation as the traveler talks,
carries what it has learned about them between Conversations, and goes on working in one
that has run for weeks. The traveler can list and reassign Trips, read and delete
everything learned about them, and rewrite the Advisor Instructions — and a failed turn
says whose problem it is and can be run again without asking the question twice.

---

## 1. Read these first

- `CLAUDE.md` — project rules. The prompt log and the commit rule are in here.
- `CONTEXT.md` — the domain glossary. **Every term carries an `_Avoid_` list, and those
  lists bind file, module and component names.** See §3.
- `docs/adr/` — the decisions already made
- `docs/agents/` — the issue tracker, triage labels and domain-doc conventions.

## 2. How the application is put together

It runs two ways:

- **Combined**, the Docker image: FastAPI serves both `/api/*` and the built Vite bundle on
  one origin, so no CORS is involved and a client-side route survives a reload
  (`app/frontend.py`).
- **Split**: the frontend on a host of its own (Vercel, in production), built with
  `VITE_API_BASE_URL` naming the backend's origin, which `api/client.ts::request` puts in
  front of every call. The backend lets in only the origins in `FRONTEND_ORIGINS`
  (comma-separated, none by default), and exposes `X-Guest-Token` so the page can read a new
  Guest's token (`main.py`).

Postgres holds everything; the schema is applied at startup, so there is no migration step.

**Accounts go through a Clerk development instance**, by decision: nothing may cost money
apart from the OpenRouter key. The browser sends Clerk's session token as a bearer
`Authorization` header. `api/clerk.py` checks it offline against `CLERK_PUBLIC_KEY` (the
dashboard's PEM key), and checks that it was issued to one of `FRONTEND_ORIGINS`, so the
combined image lists its own origin there once Accounts are on. `CLERK_SECRET_KEY` is for
Clerk's Backend API. Without both keys the backend logs that Accounts are unavailable and
serves Guests only. A frontend built without `VITE_CLERK_PUBLISHABLE_KEY` hides signing in.
Only the Clerk user ID is stored. Nothing is drawn until Clerk has loaded, and a page it
could not load on is a Guest's; signing in or out draws `App` afresh (`main.tsx`).
Clerk's sign-up screen is opened with its "Sign in" link hidden, so the rail's warning before
a Guest's sign-in can't be skipped (`AccountControls.tsx`); keep it hidden when restyling.
A social sign-up that turns out to be an existing Account still skips the warning and loses
the visit. That is accepted.

Setting Clerk up is a human's job: create the application as a development instance, choose
its sign-in methods, and put the three keys and the origins into the environments
(`.env.example`; compose passes them through, the publishable key as a build argument).

### Backend — `backend/app/`

| Layer | Holds |
|---|---|
| `api/` | routes and the SSE wire format — knows HTTP and `services/`, nothing lower |
| `services/turns.py` | one turn end to end: drives the loop, records what comes back, names the Conversation |
| `services/plans.py` · `profile.py` | applying one Trip Plan or Traveler Profile change, and reading it back for the prompt and the wire |
| `services/instructions.py` | which Advisor Instructions are in force, what saving a revision does, and the one assembly of the system prompt |
| `services/compaction.py` | folding a Conversation's oldest Messages away, and answering with what is still sent verbatim |
| `advisor/` | the model, the plan's and the profile's shapes, the keyless sources — no HTTP framework, no database, no browser |
| `db/` | SQLAlchemy tables and queries |
| `privacy/` | `outbound.py` (the one injectable HTTP client) and `queries.py` (the guard on the one free-text thing that leaves) |
| `config.py`, `frontend.py`, `main.py` | settings, static serving, composition |

Dependencies point one way: `api → services → advisor`/`db`. Nothing below reaches back up.
This is **not** enforced by a test, deliberately — see §4.

These seams do most of the design work, and new features should join them rather than go
around them:

- **`api/asking.py` is the one place a request becomes a Traveler.** A valid Clerk session
  token wins: its Clerk user's Traveler is found, or made by that first request, read or
  write. A Guest token beside it is settled there (`db/traveler.py::account_holder`): a
  Clerk user with no Traveler yet takes over the Guest's row and its token is cleared, and
  one who has a Traveler has the Guest deleted. A token that fails the check is a 401,
  never a Guest. Otherwise most routes take `who_is_asking`, which never creates anyone:
  with no valid Guest token it answers with an unsaved Traveler, so every list is empty and
  every named row is a 404. Only writes that can start from nothing take `who_is_writing`,
  which makes a Guest, committed with that write, and returns their token once in
  `X-Guest-Token`; only its hash is stored. The browser keeps it in local storage and sends
  it on every request, and lets go of it once a signed-in request succeeds
  (`frontend/src/api/client.ts::request`).
- **`services/turns.py` yields what happened, not what to send.** The wire format stays in
  `api/`, so a tool call or a Trip Plan patch can be added to a turn without the HTTP
  response shape being decided in the service.
- **One assembly composes the system prompt** — `services/instructions.py::compose_around`.
  The Advisor Instructions, the tool guidance, the Trip Plan, the Trips list, the Traveler
  Profile, the one-line names of the traveler's other Conversations and this Conversation's
  Compaction summary are put together in exactly one place, which the turn and the Advisor
  Instructions page both compose through — so what the page shows cannot drift from what the
  next Message sends. **A new injected record joins it there rather than beside it.** It
  carries one ordering constraint: `api/conversations.py::say` folds before it composes,
  because `compose_around` reads the rolling summary off the Conversation row.
- **`privacy/` is the one egress, and the one check on it.** The model client and every
  Live-data Tool take `outbound.py`'s client as a dependency; tests swap in a transport that
  answers by host, which is what keeps real request-building and response-parsing under test
  (ADR-0004). `queries.py` is the other half: the web search query is the only free text this
  application sends to a third party, so it is read for document-number shapes before the
  plan that would send it even exists (ADR-0009).
- **The tool loop is ours** (`advisor/loop.py`, ADR-0005): stream a step, accumulate the
  tool-call fragments, dispatch, append the results, re-call until the model stops asking.
  `MAX_STEPS` is the runaway guard, and a step is the last one when nothing accumulated, not
  when `finish_reason` says so — providers disagree about that. Every *fetched* result is
  wrapped in the untrusted-data delimiters named in `advisor/instructions.py`, and a lookup
  that fails becomes the result rather than an exception; a write tool's result is not
  wrapped, being the application's own account of its own write.
- **Three tool catalogues, down three branches of that loop** — one fetches and never
  writes; the Trip Plan's and the Traveler Profile's write and never fetch.
  `loop.py::_offered` is where both writing collections leave the table for the rest of a
  turn the moment anything has been fetched into it (ADR-0010), which is how ADR-0004's
  promise survives the existence of a writing tool. Three tests hold it, in
  `test_web_search.py`, `test_traveler_profile.py` and `test_live_data_tools.py`.
  **Anything else that writes joins that side and inherits the rule.**

### Frontend — `frontend/src/`

Vite, React 19, Tailwind v4, TypeScript strict. `App.tsx` composes; `api/`, `routes/` and
`stream/` sit beside a `components/` folder per area (`shell`, `conversation`, `plan`,
`trip`, `profile`, `record`) and a `design/` that is the visual system. **Every decision
worth testing has been lifted out of its component into a pure `.ts` module beside it** —
`merging`, `snapping`, `listing`, `dates` — because the suite is Node-only and nothing that
draws is reachable from it.

- **`stream/useTurn.ts` owns the only thing that unfolds over time.** A reply arrives a
  fragment at a time, may be stopped part-written, may fail, and may start and name a
  Conversation on the way. Holding that in one place is what lets everything that *shows* a
  turn stay a component that draws what it is handed; the draft lives there too. It reads
  SSE with a stream reader rather than `EventSource`, because a turn is a POST, and
  aborting the signal is the only way to stop a reply.
- **`App.tsx` holds the Conversation state**, because a turn both appends a Message to the
  open Conversation and moves its row to the top of the list, and two copies would disagree.
  The Traveler Profile lives there too — it belongs to no Conversation and any one of them
  can add to it mid-turn. The Advisor Instructions are the exception: read when their page
  is opened and put down when it is left, because the composed prompt that page shows is
  only true at the moment it was asked for.
- **A failed turn is a Message, not browser state** (ticket 14). What `useTurn` still holds
  is the one failure that recorded nothing: a turn that never reached the server.
- **`stream/events.ts` is the whole mid-turn vocabulary** — the union of what the server can
  say while a turn runs. `api/conversations.py::_as_event` is exhaustive on purpose, so a new
  member fails the backend type check rather than reaching the browser unnamed.
- **`components/plan/holding.ts` holds the Trip Plan, and `merging.ts` is the rule it
  applies.** Two writers reach one plan — the advisor mid-turn, the traveler by hand — so
  the rule is pure and tested on its own: the field under edit keeps the traveler's value,
  the rest of the patch lands, and what the advisor wanted is offered underneath.
- **`routes/routing.ts` is the whole router** (ADR-0012): three addresses in a `PATHS`
  literal. The state every screen needs lives in `App.tsx` *above* the route, so navigating
  does not take a running turn down with it, and `AppFrame` is the one fixed,
  keyboard-aware window every screen is drawn in.

## 3. Naming is bound by the glossary

`CONTEXT.md` gives each domain term an `_Avoid_` list. Check every name you are about to
write against it — this has been violated and undone more than once:

- **Chat / session / thread → `Conversation`.** The folder is `conversation/`.
- **Memory / user data / context → `Traveler Profile`.** There is no `context.*` and no
  `memory/` anywhere; a backend `context.py` was renamed `prompt.py` for exactly this.
- **Assistant / bot / agent / AI → `Advisor`.** **Trouble → `Failure`.**
- **No message bubbles.** Ticket 05 made advisor replies full-width prose on purpose.
- **No `components/ui/`** — `design/` already is the visual system. **No `lib/utils.ts`** —
  modules are named for what they do (`announcing`, `following`, `snapping`).
- **No `tailwind.config.ts`.** Tailwind v4: the `@theme static` block in `design/tokens.css`
  is the whole visual system, by decision in ticket 04.

## 4. Working rules for this repo

**Never run `git add`, `git commit` or any other git write on your own.** `CLAUDE.md` says
so and the user has repeated it. Propose the message, wait for explicit approval. Commit messages are short: a one-line subject and at most a few
sentences.


### The testing rule

> Keep tests that test functionality and whether the app works as expected. Delete tests
> that exist only to confirm the code is shaped the way we said.

This line has cost two test suites already — the backend's `test_layering.py` and the
frontend's design suite. So: no tests asserting folder structure, import direction, naming
or code style, and a restructure's proof is that the existing suite still passes. A test
that reads source files is only justified when it asserts a fact a traveler could hit. One
survives: `components/shell/layout.test.ts` reads `design/tokens.css` to check that the
breakpoints in the theme and the breakpoints in the shell are the same two numbers.

**The suites.** The frontend is vitest in a plain Node environment (`environment: "node"`,
`include: ["src/**/*.test.ts"]`, `TZ` fixed to UTC) — pure modules only, and `.tsx` is not
matched by the include pattern, so anything that draws is checked by hand. The backend is
pytest against a **real Postgres** (`docker compose up -d db` first), using its own
`travel_advisor_test` database, rebuilt from the model on every run.

## 5. Verification

Run all four. Whichever half you changed, the other one proves you did not reach into it.

```bash
cd D:/Antonio/ai-advisor-chatbot/frontend && npx tsc --noEmit && npm test && npm run build
```

```bash
cd D:/Antonio/ai-advisor-chatbot/backend && CONVERSATION_MODEL=anthropic/claude-sonnet-5 UTILITY_MODEL=anthropic/claude-haiku-4.5 D:/Antonio/ai-advisor-chatbot/.venv/Scripts/python.exe -m pytest -q
```

```bash
cd D:/Antonio/ai-advisor-chatbot/backend && D:/Antonio/ai-advisor-chatbot/.venv/Scripts/python.exe -m mypy
```

**121 frontend tests in 17 files** (~2s), `tsc` silent, build clean; **142 backend tests**
(~30s), mypy clean. Confirm those numbers *before* you start — if they do not match,
something changed underneath you. Update this paragraph when a ticket legitimately moves
them.

**The two model variables are pinned in that command on purpose.** Four backend tests read
the models out of `.env`, which is untracked and on this machine names Gemini rather than the
shipped Anthropic defaults; on a bare `pytest` run they fail for that reason alone and
nothing is wrong.

**The schema is applied at startup and never altered.** `create_all` adds a missing table but
never a missing column, so a database left over from an earlier ticket comes up missing
columns rather than failing loudly. `docker compose down -v` before verifying by hand.

**Vite proxies to `http://localhost:8000`, which resolves to `[::1]` first here.** A backend
started with `--host 127.0.0.1` is invisible to it and every `/api` call comes back 500
through the dev server. Start it with `--host ::`. That socket is IPv6-only on this machine,
so use `curl "http://[::1]:8000/..."` when checking the API by hand. And **check which
process owns port 8000, not only that one is listening** — a stale `--reload` worker served
old code on `[::1]:8000` for an hour during ticket 09 while a freshly started server bound
the other address. `netstat -ano | grep :8000`, then check the PID is the one you started.

## 6. Machine notes (Windows)

- **The virtualenv is at the repo root**, `D:\Antonio\ai-advisor-chatbot\.venv`, *not* under
  `backend/`. A bare `python -m pytest` fails with "No module named pytest".
- **Heredocs on this machine eat a level of backslashes**, so writing a file that contains
  regexes through one mangles `\d`, `\[`, `\n`. Use the `Write` tool for those — and for any
  long file, since a heredoc of a hundred lines or more has failed to parse here outright.
- **Paths are case-insensitive**: a module named `sheet.ts` beside `Sheet.tsx` collides. That
  is why the pure modules beside a component get their own names (`snapping.ts`).
- **The built-in browser pane renders the app**, but changing the emulated viewport fires
  neither `resize` nor a `matchMedia` change, so breakpoint *transitions* cannot be driven
  there. Load the page at a width instead.
- Running it: `docker compose up`, then <http://localhost:8000>. `APP_PORT` / `DB_PORT` in
  `.env` if those ports are taken. The app starts without an OpenRouter key and reports it
  missing at `/api/health`; the advisor cannot answer until one is supplied.
- Running it split: start the backend with `FRONTEND_ORIGINS=http://localhost:5173` (and
  `--host ::`), then `VITE_API_BASE_URL=http://localhost:8000 npm run dev` in `frontend/`.
  Without that variable the dev server proxies `/api` and stays on one origin.
  `.dockerignore` keeps every `.env*` out of the image, so the combined build always has
  an empty base URL.
- Signing in under the dev server: Vite reads env files from `frontend/`, not the root
  `.env`, so `VITE_CLERK_PUBLISHABLE_KEY` goes in `frontend/.env` or the command line.
  The page's origin, `http://localhost:5173`, must be in the backend's `FRONTEND_ORIGINS`
  even when the proxy keeps it on one origin, or every sign-in is refused.

## 7. Open questions — raise these, do not decide them alone

- **`db/migrations/`.** Raw SQL plus numbered migrations, versus the current SQLAlchemy
  `apply_schema()` at startup. Undecided, and it costs something every time a ticket touches
  the schema: `create_all` creates what is missing and alters nothing, so the evaluator pays
  a `docker compose down -v` if they run an image from before a change.
- **The unrouted-host assertion.** `backend/tests/fakes/canned_transport.py` still raises
  `UnroutedHost`, but nothing asserts it any more, and ADR-0004 puts the PII boundary
  precisely at egress to third parties. The user has been told. The original is in
  `git show cefc2ca:backend/tests/test_outbound_seam.py`.
- **What orders a transcript.** `db/conversations.py::messages_in` orders Messages by
  `created_at` and breaks ties on a random identifier. Twice — once during 12, once during
  13, both in `test_web_search.py` — a full-suite run came back with a Conversation's two
  Messages advisor-first, and neither would reproduce; the obvious causes were measured and
  ruled out (1µs clock steps, no equal timestamps in 3000 back-to-back inserts, no backwards
  step in 60s of sampling). 12 took its own ordering off the clock, but doing the same to
  every Message is a schema change to the oldest table here, and belongs with the migration
  question above.

## 8. Skills worth calling

**`codebase-design`** before deciding where a seam or a split lands: it carries the
deep-module vocabulary the rest of this codebase was designed with. **`code-review`** at the
end of a piece of work, with the commit you started from as the fixed point and the ticket as
the spec. Skip **`tdd`** for work that introduces no new behaviour — §4 warns against writing
a test that only describes the shape of a change.
