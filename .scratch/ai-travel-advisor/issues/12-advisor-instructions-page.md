# 12: Advisor Instructions page

**What to build:** A traveler can change how the Advisor behaves and see the change take
effect on their very next message — and can read the whole prompt that actually gets sent,
not just the part they wrote.

**Blocked by:** 11.

**Status:** ready-for-agent

- [x] A page shows the editable Advisor Instructions — the Advisor's persona and rules —
      alongside a read-only preview of the fully composed prompt exactly as it will be sent,
      including the injected Traveler Profile, Trip Plan and tool guidance
- [x] Saving creates a new Prompt Version
- [x] The next Message in any Conversation, including one started before the edit, uses the
      new version
- [x] Every Message records the Prompt Version that produced it
- [x] A reset control restores the shipped default Advisor Instructions
- [x] Mobile behaviour ships with this ticket, on the 06 primitives
- [x] A test asserts the composed prompt contains the current instructions, Profile and Plan
- [x] A test asserts editing the instructions changes the next turn of an existing
      Conversation
- [x] A test asserts each Message is stamped with the version that produced it

## Comments

All nine criteria are done and were driven through the running application against a real
model. **100 backend tests** (was 93) and **105 frontend tests in 15 files** (was 103);
`tsc --noEmit` silent, `npm run build` clean, mypy clean over 56 files.

The pass worth recording: the shipped instructions were replaced with ones ending "always
begin every reply with the single word Marmalade", and the very next message of a new
Conversation came back beginning with Marmalade. Restoring the default and then saying one
more thing **in that same Conversation** came back without it — and the two advisor Messages
carry two different `prompt_version_id`s, with the traveler's own carrying none.

How it is built:

- **A Prompt Version is a row, and the one in force is the most recent of them.** Only the
  editable part is stored: the tool guidance, the Trip Plan and the Traveler Profile
  composed around it are the application's own, so a version is never a stale copy of rules
  nobody edited. Three layers mirroring the profile's — `db/prompt_versions.py` →
  `services/instructions.py` → `api/instructions.py` — with the rules (the default is in
  force until something is saved; saving the same words is not a revision) in the service,
  because a rule asked for in a route is a rule the next route forgets.
- **The page and the turn are the same function of the same words.** `compose_system_prompt`
  takes the instructions rather than reading them, and both routes compose through
  `services/instructions.py::compose_around`; a test asserts the preview is
  character-for-character what the next turn sends. A second rendering of "what will be
  sent" is a thing that can be wrong, and this page exists so that nothing is hidden.
- **The version is read at the top of every turn** and travels with the prompt into
  `take_turn`. That is the whole of what makes an edit land on the next Message of a
  Conversation begun long before it, and it makes the stamp the version that actually
  produced the reply rather than whatever is in force by the time the reply is written down.
- **The page names the Conversation it was opened from** (`?conversation_id=`), so the Trip
  Plan in the preview is the plan their next message actually sends.

Ruled on rather than assumed: a traveler Message carries no Prompt Version, because no
prompt produced their own words — the same way they carry no cost and no Citations;
restoring is a save rather than an undo, so the versions before it stay where they are,
still explaining the Messages they produced; instructions that are empty or all whitespace
are refused (`pattern=r"\S"`), and Save says so before it is pressed; the preview shows what
is saved and says so while a draft differs, because showing a prompt that is not the one the
next message sends is the one thing this page must not do; and `GET` saves the default
version when there is none — a read that writes, deliberately, because the alternative is a
Message stamped with a version that was never recorded.

The two-axis review found four things, all fixed: the preview lost the Trip Plan when the
page was reached by its address (the read was keyed on the route alone, and the two reads a
bookmarked arrival makes were racing, with the plan-less one winning); `min_length=1` let
whitespace through, so the docstring that said the advisor is never left without
instructions was only true of the interface; both routes assembled the injected records
themselves, which `compose_around` now does once; and the page said nothing about restoring
until there was something to restore.

**The schema changed**: a database from before this ticket has no `prompt_version` table and
no `message.prompt_version_id`. `create_all` adds the table but never the column, so
`docker compose down -v`, or the one-line `alter table message add column if not exists
prompt_version_id uuid references prompt_version(id) on delete set null` used to verify this
one against an existing database. The dev database now holds the Porto Conversation the
hand-pass was driven through.

**Which version is in force is counted, not timed.** Two full-suite runs during this ticket
failed and would not reproduce — one in the new `test_an_edit_changes_the_next_turn…`, one
in `test_web_search.py`, which this ticket does not touch and which failed with a
Conversation's Messages coming back in the wrong order. The obvious explanation was measured
and is **wrong**: this Postgres advances `clock_timestamp()` in 1µs steps, 3000 back-to-back
inserts produced no two equal timestamps, and 60s of sampling found no backwards step. The
mechanism is unexplained, and nothing here claims otherwise. What did change is that
`PromptVersion.revision` is an identity column and `latest()` orders by it, so which
instructions the advisor is given no longer rests on a clock. The same exposure in
`messages_in` orders every transcript in the application: pre-existing, untouched, and
raised in HANDOFF §7 rather than changed here.

Left for a human: nothing on this ticket. Ticket 06's real-phone pass is still open and
still 06's.
