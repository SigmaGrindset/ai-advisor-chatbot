# 14: Failure modes and observability

**What to build:** When something goes wrong, the application says what — clearly enough
that someone running it for the first time can tell a configuration problem from a bug.

**Blocked by:** 08, 12.

**Status:** ready-for-agent

- [ ] A missing or invalid OpenRouter key produces a clear, structured error rendered in the
      interface — never a spinner that never resolves
- [ ] An exhausted credit balance produces its own specific message rather than a generic
      failure
- [ ] A stream that dies mid-answer persists the partial Message with an error marker and
      offers retry; the traveler's question is not lost
- [ ] A Live-data Tool that is down or slow results in the Advisor explaining it, with the
      turn completing normally
- [ ] Application logs contain no Message bodies
- [ ] The recorded per-turn cost is inspectable
- [ ] A test covers each of those error paths through the seam

## Comments

**Raised by 05, which could not settle it from the interface alone.** 05 built the inline
error and its retry control, and retry there sends the question again as a new turn, because
that is all the API offers. The server commits the traveler's Message *before* it calls the
model (`backend/app/api/conversations.py`, "Committed before the model is called"), so when a
turn fails the question is already recorded and asking again records a second copy of it. The
transcript can therefore end up carrying the same question twice with one answer.

Two things this ticket may want to decide, neither of which the existing criteria cover — the
third criterion above is about persisting a partial *reply*, and says nothing about a traveler
Message whose turn never answered:

- What becomes of a traveler Message whose turn produced nothing. Re-running the turn for it
  rather than asking again would need something the API does not have yet.
- Where the failure itself lives. In 05 the error and its retry are in memory only, so a
  reload, or leaving the Conversation and returning, loses both and leaves an unanswered
  question with no way to ask it again.

