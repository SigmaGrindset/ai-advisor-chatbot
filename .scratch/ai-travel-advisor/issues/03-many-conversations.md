# 03: Many Conversations

**What to build:** A traveler can keep several lines of thinking apart. They start a new
Conversation, see all of them listed with titles that mean something, reopen any one and
continue it, and delete the ones they no longer want.

**Blocked by:** 02.

**Status:** ready-for-agent

- [x] A traveler can start a new Conversation without leaving the application
- [x] All Conversations appear in a list ordered by most recent activity
- [x] Each Conversation carries a title derived from its first exchange by the utility
      model, falling back to a truncated first Message if that call fails
- [x] Reopening a Conversation restores its full transcript and allows it to continue
- [x] Deleting a Conversation asks for confirmation once, then removes it and its Messages
      for good — no soft-delete flag, no hidden rows
- [x] A test asserts that deleting a Conversation removes its Messages
- [x] A test asserts the title falls back correctly when the utility model call fails

## Comments

Implemented. Verified on this machine, in the browser, against the real OpenRouter API:
two Conversations were started, each streamed a reply, and the utility model named them
**"Porto in May: Three Days"** and **"Bruges in October Two Nights"** — each title
appearing in the list without a reload, and the list reordering so the one just used sat
at the top. Reopening the Conversation from ticket 02 restored its whole transcript;
deleting a Conversation asked once and removed it; a reload came back to the most
recently active one. 36 backend tests pass, `mypy --strict` and `tsc --noEmit` are clean.

Shape of it:

- `/api/conversation` became `/api/conversations`, as 02 said it would: `GET` lists,
  `POST` starts, `GET|DELETE /{id}` reads and removes, and `POST /{id}/messages` is the
  streamed turn.
- Most recent activity is **derived, not stored** — `coalesce(max(message.created_at),
  conversation.created_at)`. The spec's data model names an activity timestamp on the
  Conversation, but storing one means a second clock and a write path that can drift
  from what was actually said. The subquery cannot.
- `app/titles.py` names a Conversation after the first exchange that completes in it.
  Every way the naming call can disappoint — an API error, a timeout, an empty answer —
  ends at the same fallback: the traveler's own first words, shortened at a word
  boundary to 48 characters. If even that is empty, because the Message was pure
  whitespace, the Conversation is left **unnamed** rather than named the empty string:
  unnamed, its next exchange can still name it; named the empty string, it never could,
  and the list would show a blank row.
- Naming is the **last** thing a turn does, after the advisor Message is committed and
  after the browser has been sent it. It is a second round trip to a second model, and
  the traveler's turn is over by the time it starts, so a slow or failing naming call
  costs them nothing but a title arriving a moment later.
- It is guarded by `title is None`, so a title is written once and never rewritten
  underneath someone who has learnt to recognise it.
- `conversation_titled` joins the turn's stream events, so the list renames itself as the
  first reply lands rather than on the next reload.
- Deletion is `DELETE` → 204 and the database's own `on delete cascade`. The test that
  proves it counts rows in Postgres rather than asking the API — the API cannot tell a
  deleted row from a hidden one, which is the whole point of the requirement. It is the
  only test in the suite that looks past the seam, and says so in its docstring.
- `Conversation.created_at` moved to `clock_timestamp()` for the reason `Message` already
  had: `now()` is the transaction timestamp, so two Conversations started inside one
  transaction shared a timestamp and the list order between them was arbitrary.
- A Conversation the traveler never says anything in is one that never needed to exist,
  so **"New conversation" writes nothing**. It clears the interface to a blank thread,
  and the first thing said in it is what starts it. Clicking it repeatedly cannot litter
  the list, and a traveler with no Conversations at all stays a reachable state for 05 to
  give an empty area to.
- The browser keeps one turn in flight at a time, but a reply is addressed to the
  Conversation it belongs to, so opening another one mid-stream cannot land the advisor's
  words in the wrong place.

Deliberate deviations, and what was left for later tickets:

- **There is still no migration story.** The schema step creates what is missing and
  never alters what is there, so a database from an earlier commit does not gain the new
  `conversation.title` column. The test harness now drops and rebuilds its schema on
  every run, and the README says to recreate the application's database after a schema
  change. This was already true before this ticket; it is now the first ticket where it
  bites. A real answer (Alembic, or a bounded additive reconciler) deserves its own
  ticket rather than being smuggled into this one.
- **What the naming call costs is not recorded.** An earlier draft folded it into the
  advisor Message's `cost_usd`, which quietly changed what that column means: the spec
  defines it as the figure from the final stream chunk, and the naming call is a separate,
  unstreamed request. 03 has no cost criterion, so the honest thing is to leave `cost_usd`
  meaning exactly what 02 made it mean. 14 owns making spend inspectable and should pick
  up the utility model's share of it — titles now, Compaction summaries and the nested
  search later.
- The utility-model test from 02 (`test_the_utility_model_is_named_by_the_environment`)
  was marked there as a deviation because nothing consumed the setting yet. It is now
  driven through the API like everything else, and the deviation is retired.
- Confirmation is an inline two-step control in the list row — the delete button becomes
  "Delete / Keep" — rather than a native dialog. It asks once, it is a visible control
  rather than a hidden gesture, and 04 restyles it without changing what it does. It has
  **no test**: there is no frontend test framework in this project, and adding one is not
  this ticket's to choose. The two tests the ticket demanded are both backend, and both
  are there.
- The Conversation list is a fixed `w-64` rail with no `min-width` query, which is not the
  mobile-first structure ADR-0007 commits to. 04 owns the shell and 06 owns the
  breakpoints, and ADR-0006 already says the list is what gives way first; this is a
  placeholder that stays out of their way rather than a considered layout.
- Still raw Tailwind colour utilities rather than the semantic token layer, which is
  04's, and no client-side router: selecting from the list is what reopening means for
  now. A reload lands on the most recently active Conversation, which is where the
  traveler was.
- A deleted Conversation takes nothing else with it, but there is no Trip Plan or
  Traveler Profile yet for it to spare. The test asserts only that other Conversations
  survive; 09 and 11 extend it to what they add.
- The list shows titles and nothing else — no timestamps, no Trip grouping. Trip
  grouping is 10's.
