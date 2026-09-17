# 13: Compaction and cross-conversation awareness

**What to build:** A traveler who has been chatting for weeks finds the Conversation still
works — it doesn't slow down, get expensive, or fail — and the Advisor knows that their
other threads exist without being told.

**Blocked by:** 11.

**Status:** ready-for-agent

- [ ] Crossing a token budget folds the oldest Messages into the Conversation's rolling
      summary and removes them from the composed prompt only
- [ ] The full transcript remains stored and visible to the traveler; Compaction never
      shortens what they can read
- [ ] Compaction is not surfaced in the interface in any way
- [ ] Compaction is triggered by token budget rather than Message count, so large tool
      results are accounted for
- [ ] One-line summaries of the traveler's other Conversations are composed into the prompt,
      so the Advisor knows another thread about the trip exists
- [ ] Compaction and summarisation use the utility model
- [ ] A test asserts that crossing the budget shrinks the composed prompt while leaving the
      stored transcript intact
- [ ] A test asserts the rolling summary is present in the composed prompt after compaction
