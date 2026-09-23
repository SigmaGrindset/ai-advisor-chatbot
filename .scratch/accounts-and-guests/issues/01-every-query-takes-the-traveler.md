# 01: Every query takes the Traveler explicitly

**What to build:** a prefactor with no visible change. Every query that currently reads the hard-coded sole Traveler takes the Traveler as an argument instead. That covers the Traveler Profile, Conversations, Trips and Prompt Versions. So do the plan and profile tools a turn is handed, the prompt composition, and "Delete everything". The routes get the Traveler from a single "who is asking" dependency, which for now always answers with the sole Traveler. Swapping what that dependency returns is then all that ticket 02 has to do.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] No query module refers to the sole Traveler's identifier. Only the "who is asking" dependency does, along with the startup step that seeds it.
- [x] Ownership checks on a Conversation, a Trip or a Profile Fact compare against the Traveler passed in.
- [x] A turn's plan and profile tools, and the composed system prompt, act on the Traveler passed in.
- [x] The existing test suite passes unchanged.

## Comments

Open for 02: every query expects a `Traveler`, not `Traveler | None`. A read with no Traveler must either change those signatures or pass in an unsaved placeholder, so 02 is more than a swap inside the dependency.
