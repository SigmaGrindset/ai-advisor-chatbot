# 13: Compaction and cross-conversation awareness

**What to build:** A traveler who has been chatting for weeks finds the Conversation still
works — it doesn't slow down, get expensive, or fail — and the Advisor knows that their
other threads exist without being told.

**Blocked by:** 11.

**Status:** ready-for-agent

- [x] Crossing a token budget folds the oldest Messages into the Conversation's rolling
      summary and removes them from the composed prompt only
- [x] The full transcript remains stored and visible to the traveler; Compaction never
      shortens what they can read
- [x] Compaction is not surfaced in the interface in any way
- [x] Compaction is triggered by token budget rather than Message count, so large tool
      results are accounted for
- [x] One-line summaries of the traveler's other Conversations are composed into the prompt,
      so the Advisor knows another thread about the trip exists
- [x] Compaction and summarisation use the utility model
- [x] A test asserts that crossing the budget shrinks the composed prompt while leaving the
      stored transcript intact
- [x] A test asserts the rolling summary is present in the composed prompt after compaction

## Comments

All eight criteria are done.

**Nothing in the frontend changed, on purpose.** "Not surfaced in the interface in any way"
is cheapest to keep by never telling the browser: no event, no field on any view.

**The budget is over the Messages still sent verbatim, not the whole prompt** — the system
prompt is thousands of tokens that cannot be folded, so counting it would only move a
constant. `TRANSCRIPT_BUDGET` 6000, `KEPT_VERBATIM` 2000: crossing the first folds down past
the second, so the next several turns pay for no summarising call. Tokens are estimated at
four characters each rather than counted; what the number has to be right about is only
*when* a Conversation has grown long.

**Folded before the prompt is composed, not after the turn** — otherwise the turn that
crosses the budget sends the long prompt once, which is the turn that should not. A
summarising call that fails folds nothing and the next turn tries again: a turn that is
briefly dearer beats an advisor missing the middle of the conversation it is in.

**How much is folded is a count on the Conversation, not a mark on each Message.** Messages
are only appended, so the count cannot go stale, and Compaction stays a fact about the
Conversation rather than something done to a Message the traveler still reads in full. The
last Message is never folded — it is the one they are waiting on a reply to — so
`KEPT_VERBATIM` sits above the 8000 characters a Message is bounded at.

**"So large tool results are accounted for" does not bite here.** Tool results are never
persisted; only the advisor's final prose is. What still varies wildly in size is a Message,
so the trigger is a token budget for that reason rather than the ticket's.

**Other Conversations are known by name and Trip, never by content** — **ADR-0013**, because
"one-line summaries" could as easily have been read as a generated gist, which costs a call
per Conversation per turn and undoes the separation the traveler asked for. At most the ten
most recently spoken in, so this part of the prompt is bounded.

Both new records joined `compose_around`, the one assembly the turn and the Advisor
Instructions page already shared, so the page still shows what the next Message sends
character for character. **The schema changed** — see `HANDOFF.md` §5.

Two findings from the review were reported and left: the tuple `conversations_apart_from`
answers with is unnamed, because `db/` deliberately does not know the advisor's shapes; and
the Advisor Instructions page renders "short enough to be sent whole" only when opened from
nowhere in particular, which the browser never does.
