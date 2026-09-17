# Structured Traveler Profile over retrieval across past conversations

The advisor must draw on earlier conversations instead of asking the traveler the same
things again. We record what it learns as a **Traveler Profile** — a small structured
record of Profile Facts that the advisor writes to via a tool call as durable facts
surface — rather than embedding past Messages and retrieving them semantically each turn.

## Considered Options

- **Embeddings + semantic retrieval over all past Messages.** The expected answer, and
  rejected deliberately. Recall is fuzzy, it needs a vector store and an embedding call
  per message, and — decisively — it drags whatever happens to be near in vector space
  into context, so passport details surface on turns that have nothing to do with them.
- **Rolling summaries of every past Conversation, all prepended.** Grows without bound.

## Consequences

The Traveler Profile is enumerable, which is what makes "here is everything the advisor
knows about you, delete any line of it" buildable — see ADR-0004. Facts only enter it when
the advisor calls the tool, so an occasional miss is possible; the next turn catches it,
and that is cheaper than an extraction pass on every message.
