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

Implemented and driven in the browser against a real model: two Conversations streamed
replies and were named by the utility model without a reload, the list reordered so the
one just used sat at the top, deleting asked once, and a reload came back to the most
recently active one. 36 backend tests pass, `mypy --strict` and `tsc --noEmit` clean.

- `/api/conversation` became `/api/conversations`, as 02 said it would.
- **Most recent activity is derived, not stored** —
  `coalesce(max(message.created_at), conversation.created_at)`. The spec's data model
  names a stored timestamp, but that means a second clock and a write path that can drift
  from what was actually said.
- **Naming falls back to the traveler's own first words**, shortened at a word boundary to
  48 characters, for every way the call can disappoint. If even that is empty the
  Conversation is left **unnamed** rather than named the empty string: unnamed, its next
  exchange can still name it; named the empty string, it never could.
- **Naming is the last thing a turn does**, after the browser has been sent the reply, and
  is guarded by `title is None` — a slow naming call costs the traveler nothing, and a
  title is never rewritten underneath someone who has learnt to recognise it.
- **Deletion's test counts rows in Postgres rather than asking the API**, which cannot
  tell a deleted row from a hidden one. It is the only test in the suite that looks past
  the seam, and says so in its docstring.
- **"New conversation" writes nothing.** It clears the interface; the first thing said is
  what starts it. Clicking it repeatedly cannot litter the list.
- A reply is addressed to the Conversation it belongs to, so opening another one
  mid-stream cannot land the advisor's words in the wrong place.

Deviations, and what was left for later tickets:

- **There is still no migration story.** The schema step creates what is missing and never
  alters what is there, so a database from an earlier commit does not gain
  `conversation.title`. The harness rebuilds its schema every run and the README says to
  recreate the application's. A real answer deserves its own ticket.
- **What the naming call costs is not recorded.** Folding it into the advisor Message's
  `cost_usd` would change what that column means — the spec defines it as the figure from
  the final stream chunk. 14 owns making spend inspectable, including the utility model's
  share.
- Delete confirmation is an inline two-step control rather than a native dialog, and has
  **no test**: there is no frontend test framework yet, and choosing one is not this
  ticket's call.
- The list is a fixed `w-64` rail with no `min-width` query, which is not the mobile-first
  structure ADR-0007 commits to. A placeholder that stays out of 04's and 06's way.
- Still raw Tailwind colours (04's) and no router: selecting from the list is what
  reopening means for now. Trip grouping is 10's.
