# 12: Advisor Instructions page

**What to build:** A traveler can change how the Advisor behaves and see the change take
effect on their very next message — and can read the whole prompt that actually gets sent,
not just the part they wrote.

**Blocked by:** 11.

**Status:** ready-for-agent

- [ ] A page shows the editable Advisor Instructions — the Advisor's persona and rules —
      alongside a read-only preview of the fully composed prompt exactly as it will be sent,
      including the injected Traveler Profile, Trip Plan and tool guidance
- [ ] Saving creates a new Prompt Version
- [ ] The next Message in any Conversation, including one started before the edit, uses the
      new version
- [ ] Every Message records the Prompt Version that produced it
- [ ] A reset control restores the shipped default Advisor Instructions
- [ ] Mobile behaviour ships with this ticket, on the 06 primitives
- [ ] A test asserts the composed prompt contains the current instructions, Profile and Plan
- [ ] A test asserts editing the instructions changes the next turn of an existing
      Conversation
- [ ] A test asserts each Message is stamped with the version that produced it
