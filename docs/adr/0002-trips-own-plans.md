# Trips own Trip Plans; Conversations attach to a Trip

The brief says a Conversation "should produce" a Trip Plan, and also that a traveler plans
one trip across several Conversations. Those pull apart. We resolve it by making the
**Trip** the owner: a Trip has exactly one Trip Plan, and each Conversation attaches to a
Trip, so several threads refine the same plan.

## Considered Options

- **One Trip Plan per Conversation.** The literal reading of the first sentence. Two
  conversations about the same journey then produce two competing plans, which is the
  continuity failure the brief complains about elsewhere.
- **Exactly one Trip Plan for the traveler.** Simplest thing that satisfies continuity,
  but breaks as soon as someone plans a second journey.

## Consequences

The advisor is shown existing Trips and chooses whether to join one or start a new one, so
it can attach a Conversation to the wrong Trip; the UI therefore needs a way to reassign.
The advisor changes the plan through small typed tools that patch individual fields rather
than rewriting the whole document, so manual edits made by the traveler between turns are
not clobbered.
