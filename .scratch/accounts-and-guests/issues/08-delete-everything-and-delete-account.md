# 08: "Delete everything" keeps the Account, and "Delete account" removes it

**What to build:**
- **"Delete everything"** on an Account deletes every Conversation, Trip, Profile Fact and Prompt Version and leaves the Account signed in, now empty. Its confirmation names the Advisor Instructions among what goes, and for an Account holder says the Account stays.
- **"Delete account"** is a new control beside it in the Traveler Profile panel, shown to Account holders only. It deletes the Traveler and the Clerk user together. The Traveler's deletion commits only once Clerk's Backend API confirms the user is gone. The call goes through the application's single outbound client. If Clerk refuses, nothing is deleted and the Traveler is told.
- **Clerk's own account deletion** is switched off in the Clerk dashboard, so this is the only way an Account is deleted.

**Blocked by:** 05.

**Status:** closed

- [x] "Delete everything" keeps the Traveler's identity and its Clerk user ID. The next request after it resolves to the same, now empty, Traveler.
- [ ] "Delete account" asks for confirmation. On success it signs the Traveler out, and the application reads as empty.
- [x] If Clerk's Backend API refuses or fails, the Traveler and all their data are untouched, and the failure is shown.
- [x] Tests, with the outbound transport fake answering Clerk's host, cover "Delete everything" emptying an Account and keeping it, "Delete account" removing both, and "Delete account" changing nothing when Clerk refuses.
- [x] The Clerk dashboard step is recorded in `HANDOFF.md` with the other manual Clerk setup.

## Comments

Not driven by hand: signing out after "Delete account" needs a pass against a real Clerk
instance, which this machine hasn't got. Switching off Clerk's own account deletion is
recorded in `HANDOFF.md`, but a human still has to switch it off in the dashboard.
A request made with the deleted user's session token in the minute it stays valid makes an
empty Traveler nobody can sign in to, and the sweep never removes it. That is accepted.
