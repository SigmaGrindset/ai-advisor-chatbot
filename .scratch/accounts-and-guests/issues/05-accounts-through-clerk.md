# 05: Accounts through Clerk

**What to build:** a Traveler can sign up, sign in and sign out through Clerk, and an Account holder's Conversations, Trips, Traveler Profile and Advisor Instructions are there on any device they sign in from.

- **The controls:** "Sign in" and "Sign up" sit at the bottom of the conversation rail and open Clerk's components as a modal. Once signed in, Clerk's user button takes their place.
- **The token:** the browser sends Clerk's session token as a bearer `Authorization` header on every request.
- **The backend** verifies it offline against the instance's public key held in settings, checks the authorized party against the allowed frontend origins, and resolves the request to the Traveler with that Clerk user ID. If none exists yet, it creates one.
- **Guest tokens, for now:** a Clerk session simply takes precedence, and the Guest is left for the sweep. Ticket 06 replaces this.
- **Clerk is a development instance,** by decision.

**Blocked by:** 02.

**Status:** closed

- [x] The Traveler row gains a unique, nullable Clerk user ID. No email address, name or other identity detail is stored.
- [x] A request with a valid Clerk token resolves to that Clerk user's Traveler, created on the first such request, whether it's a read or a write.
- [x] A Clerk token that is present but invalid, expired or from another authorized party gets a 401. It never falls back to a Guest.
- [x] Two Accounts can't read or change each other's data, including by identifier.
- [ ] Signing out leaves the browser with no token of either kind, and the application reads as empty. Signing back in brings everything back.
- [x] Settings gain the Clerk public key and secret key. Without them, the backend starts, logs that Accounts are unavailable, and serves Guests only. A frontend built without a publishable key hides the sign-in controls.
- [x] Neither kind of token appears in a log.
- [ ] When Clerk is configured, the Guest notice adds that signing up keeps everything. The Profile panel's line about keeping data mentions the day without use only to a Guest.
- [x] Tests sign their own session tokens with a test key whose public half is in the test settings, so the real verification runs. They cover finding and creating an Account's Traveler, isolation between Accounts, the 401, and the sweep leaving an Account idle for a day untouched.
- [x] `HANDOFF.md` covers Clerk and its settings. The original spec's out-of-scope line about authentication and multiple travelers no longer claims either is out of scope.

## Comments

Not driven by hand: there is no Clerk instance on this machine, so signing in and out still
needs a pass once one exists. The notice's clause about signing up is held back until 06,
because until then signing up doesn't keep the visit; the Profile panel half of that box is
done. The browser already forgets its Guest token after the first signed-in request succeeds,
which is 06's browser half. The combined image names its own origin in `FRONTEND_ORIGINS`,
and an Account's Traveler is committed by its first request rather than with a write, since
there is no token to lose.
