# Structured Traveler Profile over retrieval across past conversations

What the advisor learns about the traveler goes into a **Traveler Profile** — a small
structured record of Profile Facts, written by tool call as durable facts surface — rather
than embeddings over past Messages, retrieved semantically each turn.

Retrieval was the expected answer and is rejected deliberately: recall is fuzzy, it needs
a vector store and an embedding call per message, and it drags whatever happens to be near
in vector space into context, so passport details surface on turns that have nothing to do
with them. A structured record is also enumerable, which is what makes "here is everything
the advisor knows about you, delete any line of it" buildable (ADR-0004).
