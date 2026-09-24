# 06: What becomes of a Guest's work at sign-in

**What to build:**
- **Signing up:** a Guest who signs up keeps everything from the visit as the same Traveler: Conversations, Trips, Profile Facts and Advisor Instructions.
- **Signing in to an existing Account:** the visit's work is left behind and deleted immediately.
- **The warning:** a Guest who has written anything is asked to confirm before Clerk's sign-in opens, and is pointed to signing up instead. Signing up needs no confirmation.
- **How it's settled:** the first request after signing in carries both tokens and settles it. After that, the browser forgets its Guest token.

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] A request with a valid Clerk token for a Clerk user with no Traveler, and a valid Guest token, sets the Clerk user ID on the Guest's Traveler and clears its Guest token. Nothing is copied.
- [ ] A request with a valid Clerk token for a Clerk user who already has a Traveler, and a valid Guest token, deletes the Guest's Traveler in that request.
- [ ] Once signed in and that first request has answered, the browser no longer holds or sends a Guest token.
- [ ] When Clerk is configured, the Guest notice adds that signing up keeps everything (held back from 05).
- [ ] The warning appears only for a Guest who has written something, only on "Sign in", and names what will be left behind.
- [ ] Tests cover adoption on sign-up, with the Guest's Conversations, Trip, Profile Fact and instructions all readable through the Account, and deletion on sign-in to an existing Account.
