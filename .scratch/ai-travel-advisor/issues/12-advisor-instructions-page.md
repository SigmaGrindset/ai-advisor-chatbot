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
model. The pass worth recording: the shipped instructions were replaced with ones ending
"always begin every reply with the single word Marmalade", and the very next message of a
new Conversation came back beginning with Marmalade. Restoring the default and then saying
one more thing **in that same Conversation** came back without it — and the two advisor
Messages carry two different `prompt_version_id`s, with the traveler's own carrying none.

- **A Prompt Version is a row, and the one in force is the most recent of them.** Only the
  editable part is stored: the tool guidance, the Trip Plan and the Traveler Profile
  composed around it are the application's own, so a version is never a stale copy of rules
  nobody edited. The rules (the default is in force until something is saved; saving the
  same words is not a revision) live in the service, because a rule asked for in a route is
  a rule the next route forgets.
- **The page and the turn are the same function of the same words.** Both routes compose
  through `services/instructions.py::compose_around`, and a test asserts the preview is
  character-for-character what the next turn sends. A second rendering of "what will be
  sent" is a thing that can be wrong, and this page exists so that nothing is hidden.
- **The version is read at the top of every turn** and travels with the prompt into
  `take_turn`. That is the whole of what makes an edit land on the next Message of a
  Conversation begun long before it, and it makes the stamp the version that actually
  produced the reply rather than whatever is in force by the time the reply is written down.
- **The page names the Conversation it was opened from** (`?conversation_id=`), so the Trip
  Plan in the preview is the plan their next message actually sends.
- **Which version is in force is counted, not timed.** `PromptVersion.revision` is an
  identity column and `latest()` orders by it. The same exposure in `messages_in` orders
  every transcript in the application: pre-existing, untouched, and raised in `HANDOFF.md`
  §7 rather than changed here.

Ruled on rather than assumed: a traveler Message carries no Prompt Version, because no
prompt produced their own words — the same way they carry no cost and no Citations;
restoring is a save rather than an undo, so the versions before it stay where they are,
still explaining the Messages they produced; instructions that are empty or all whitespace
are refused, and Save says so before it is pressed; the preview shows what is saved and says
so while a draft differs, because showing a prompt that is not the one the next message
sends is the one thing this page must not do; and `GET` saves the default version when there
is none — a read that writes, deliberately, because the alternative is a Message stamped
with a version that was never recorded.

**The schema changed** — see `HANDOFF.md` §5 for what an older database is missing.

Left for a human: nothing on this ticket.
