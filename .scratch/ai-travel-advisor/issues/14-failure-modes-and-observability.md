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
