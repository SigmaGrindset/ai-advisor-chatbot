# Trips own Trip Plans; Conversations attach to a Trip

The brief says a Conversation "should produce" a Trip Plan, and also that a traveler plans
one trip across several Conversations. Those pull apart. The **Trip** is the owner: it has
exactly one Trip Plan, and each Conversation attaches to a Trip, so several threads refine
the same plan. One plan per Conversation — the literal reading — leaves two competing
plans for one journey, which is the continuity failure the brief complains about
elsewhere.

The advisor picks which Trip a Conversation joins, so it can pick wrong and the interface
needs a way to reassign. It patches individual plan fields through typed tools rather than
rewriting the document, so edits the traveler made between turns are not clobbered.
