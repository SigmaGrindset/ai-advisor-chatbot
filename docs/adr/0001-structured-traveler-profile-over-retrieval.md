# A structured Traveler Profile, not retrieval

What the advisor learns about the traveler goes into a small structured record of Profile
Facts, written by tool call — not embeddings over past messages. Retrieval is fuzzy, needs
a vector store, and pulls passport details into turns that have nothing to do with them;
a structured record can be listed and deleted line by line (ADR-0004).
