# 10: Trips list and reassignment

**What to build:** A traveler planning more than one journey can tell them apart. Several
Conversations refining one Trip are visibly a group, all Trips are listable in one place,
and a Conversation the Advisor attached to the wrong Trip can be moved.

**Blocked by:** 09.

**Status:** ready-for-agent

- [ ] A Trips page lists every Trip with a summary of its Trip Plan
- [ ] Each row in the Conversation list carries a Trip chip in that Trip's deterministic
      pastel, so threads about one journey are recognisable at a glance
- [ ] A Conversation with no Trip yet is shown as such rather than hidden or grouped
      arbitrarily
- [ ] A Conversation can be reassigned to a different Trip, or detached from one
- [ ] Several Conversations attached to the same Trip refine the same Trip Plan
- [ ] The Trip switcher in the plan pane header moves between Trips
- [ ] Mobile behaviour ships with this ticket, on the 06 primitives
- [ ] A test asserts that two Conversations attached to one Trip see the same Trip Plan
