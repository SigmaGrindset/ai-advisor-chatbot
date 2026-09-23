# 02: Every visitor is their own Guest

**What to build:** two browsers opening the application see completely separate Conversations, Trips, Traveler Profiles and Advisor Instructions.

- **Before the first write,** someone who has written nothing is a Traveler with no row. Every read answers as an empty Traveler would: no Conversations, no Trips, an empty Profile, and the default Advisor Instructions composed with nothing around them. A named Conversation or Trip gets a 404.
- **The first write creates a Guest,** whether that's starting a Conversation, sending a Message, editing the plan, the Profile or the instructions. It returns an opaque Guest token in a response header. The server keeps only the token's hash.
- **The browser keeps the token** in local storage and sends it as a header on every request, the streamed turn included.
- **Dead tokens:** a token the server doesn't recognise is treated as no Guest.

**Blocked by:** 01.

**Status:** closed

- [x] The sole Traveler, and the startup step that seeds it, are gone. A fresh database needs nothing but the schema.
- [x] The Traveler row gains a unique, nullable Guest token hash.
- [x] The "who is asking" dependency has a read form (the Traveler, if any) and a write form (the Traveler, creating a Guest if none).
- [x] Reads with no token create nothing. That includes the Advisor Instructions page: the shipped default becomes a Traveler's first Prompt Version when their first turn is composed, not when the page is read.
- [x] One Guest can't read or change another's Conversations, Trips, Profile Facts or Advisor Instructions, including by identifier.
- [x] The Guest token never appears in a log.
- [x] "Delete everything" deletes a Guest's Traveler. The next write starts a new Guest with a new token.
- [x] The test client keeps any Guest token a response returns and sends it back, so the existing tests keep reading as one Traveler.
- [x] New tests cover isolation between two Guests, a read that creates nothing, and an instructions read that writes nothing.
- [x] `HANDOFF.md` no longer describes a single implicit Traveler.

## Comments

Only starting a Conversation and saving or restoring the Advisor Instructions take `who_is_writing`. Every other write names a row that nobody but a Guest can have, so it keeps the read form and 404s. The new Guest is flushed, not committed, and lands with the write that needed it, so 05 should create a Clerk user's Traveler the same way.
