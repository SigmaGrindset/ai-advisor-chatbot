# 11: Traveler Profile and data controls

**What to build:** The Advisor stops asking the same questions. A traveler who mentioned
their nationality last week doesn't mention it again — and can see exactly what was
remembered, and delete any part of it.

**Blocked by:** 09.

**Status:** ready-for-agent

- [ ] The Advisor records durable facts as Profile Facts through a tool it calls during a
      turn, not through a separate extraction pass on every Message
- [ ] The Traveler Profile is composed into every turn's prompt, so a brand-new Conversation
      already knows nationality, home city and travel companions
- [ ] The Traveler tab lists every Profile Fact in plain language
- [ ] Any single Profile Fact can be deleted on its own
- [ ] A correction made in conversation updates the stored fact rather than accumulating a
      contradiction
- [ ] A clear-all-data control removes Conversations, Trips, Trip Plans and the Traveler
      Profile
- [ ] Deleting one Conversation leaves the Trip Plan and the Traveler Profile intact
- [ ] Mobile behaviour ships with this ticket, on the 06 primitives
- [ ] A test asserts deleting a Conversation does not remove Profile Facts or Trip Plan data
- [ ] A test asserts a tool result cannot cause a Profile write
