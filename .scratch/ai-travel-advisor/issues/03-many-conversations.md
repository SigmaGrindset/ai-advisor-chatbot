# 03: Many Conversations

**What to build:** A traveler can keep several lines of thinking apart. They start a new
Conversation, see all of them listed with titles that mean something, reopen any one and
continue it, and delete the ones they no longer want.

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] A traveler can start a new Conversation without leaving the application
- [ ] All Conversations appear in a list ordered by most recent activity
- [ ] Each Conversation carries a title derived from its first exchange by the utility
      model, falling back to a truncated first Message if that call fails
- [ ] Reopening a Conversation restores its full transcript and allows it to continue
- [ ] Deleting a Conversation asks for confirmation once, then removes it and its Messages
      for good — no soft-delete flag, no hidden rows
- [ ] A test asserts that deleting a Conversation removes its Messages
- [ ] A test asserts the title falls back correctly when the utility model call fails
