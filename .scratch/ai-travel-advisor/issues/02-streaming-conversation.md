# 02: A Conversation that streams

**Status:** closed

Replies stream to the browser as server-sent events over a POST and survive a reload. The
traveler's Message is saved before the model is called, so a turn that dies mid-stream
keeps their words. Each turn's cost comes from `usage.cost` on the final stream chunk.
