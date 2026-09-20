# 14: Failure modes and observability

**What to build:** When something goes wrong, the application says what — clearly enough
that someone running it for the first time can tell a configuration problem from a bug.

**Blocked by:** 08, 12.

**Status:** ready-for-agent

- [x] A missing or invalid OpenRouter key produces a clear, structured error rendered in the
      interface — never a spinner that never resolves
- [x] An exhausted credit balance produces its own specific message rather than a generic
      failure
- [x] A stream that dies mid-answer persists the partial Message with an error marker and
      offers retry; the traveler's question is not lost
- [x] A Live-data Tool that is down or slow results in the Advisor explaining it, with the
      turn completing normally
- [x] Application logs contain no Message bodies
- [x] The recorded per-turn cost is inspectable
- [x] A test covers each of those error paths through the seam

## Comments

All seven criteria are done. Every path was driven through the interface against the real
provider, a provider handed a key it would not take, and a stand-in that starts an answer
and then gives up.

**Both of 05's open questions are settled the same way: a failed turn is a Message.** 05
left two — what becomes of a traveler Message whose turn produced nothing, and where the
failure itself lives, since its error and retry were in memory only and a reload lost both.
The Message holds whatever had arrived of the reply — empty when nothing had — marked with
its kind and the sentence the traveler is shown, so a reload still finds the question, what
became of it, and the control that runs it again. Retry is a route of its own
(`POST /conversations/{id}/messages/{message_id}/again`) that discards that Message and
answers the question already recorded, so the question is never said twice. Only the last
turn can be run again, in the server as well as the interface — a reply arriving above
questions the traveler has since asked would answer one they have moved on from. The one
failure still kept in the browser is a turn that never reached the server at all.

**Four kinds, decided in one place** (`advisor/failures.py`): `configuration`, `credit`,
`upstream`, `application`, read from the provider's status or from the code it sends when a
stream gives up partway, so a 402 before the turn and a 402 mid-answer are labelled alike.
The interface labels the sentence with the kind, because "something went wrong" is the one
thing that leaves the reader nowhere: NOT CONFIGURED above *"Set OPENROUTER_API_KEY and
start the application again"* is the difference between a five-second fix and a bug report.

**A failed Message is shown to the traveler and never sent back to the advisor** — not
verbatim and not through Compaction's summary, which is the second way into a prompt. It is
a sentence nobody finished, and an advisor shown one would take it for something it had
decided to say.

**An application fault says it is one** rather than blaming the advisor, and is logged with
the file and line it came from and nothing else — not the exception's own message, because a
database error carries the statement that failed and the parameters bound into it, and for a
Message those parameters are its content. The engine is built with `hide_parameters=True`
for the same reason.

Deviations and what was deliberately not built:

- **The Live-data Tool criterion needed no new code.** 07 already turns a source that is
  down or slow into a tool result the advisor explains, with a test through the seam; the
  new suite points at it rather than writing a second copy.
- **No health banner and no spend total.** The criteria ask for the failure where the
  traveler is looking and for cost to be inspectable; a second surface saying the same thing
  before they ask would be noise.
- **Three limits were accepted rather than engineered away**: a turn that fails after
  patching the Trip Plan keeps the patch, so running it again can apply it twice; "only the
  last turn" is a check rather than a lock, so two tabs retrying in the same instant race;
  and a turn that dies reports no cost, because the figure comes on the provider's last
  chunk and there was not one.

**`CONTEXT.md` gained one term, Failure**, whose `_Avoid_` list names *Trouble*. **The schema
changed** — see `HANDOFF.md` §5.
