# 03: Guests expire, and are told so

**What to build:** a Guest's Traveler, with everything it owns, is deleted once 24 hours pass without a request from that Guest, and the Guest is told this once. Every request carrying a valid Guest token updates that Guest's last-active time. The sweep is a plain function that takes "now". For now it runs on an hourly timer started with the application; if the backend host turns out to be serverless, it moves to a cron entry point. After a Guest's first completed turn, a one-time notice says nothing is kept after a day without use, and that signing up keeps it. The Guest dismisses it and doesn't see it again.

**Blocked by:** 02.

**Status:** closed

- [x] The Traveler row gains a last-active timestamp, updated by every request that carries a valid Guest token, reads included.
- [x] The sweep deletes every Traveler identified by a Guest token whose last activity is more than 24 hours before the given "now". Everything they own goes on the existing cascades.
- [x] An Account's Traveler never holds a Guest token (05 creates it without one, and 06 clears it on adoption), so the sweep can never touch an Account.
- [x] The hourly timer starts and stops with the application, and a failing sweep logs and waits for the next hour rather than taking the application down.
- [x] A test moves a Guest's last activity back 25 hours, runs the sweep, and finds over HTTP that the Guest's token now reads as empty, while a recently active Guest is spared.
- [x] The notice appears after a Guest's first completed turn, once per Guest. A new Guest after a deleted visit sees it again. It's remembered in the browser against that Guest's token.
- [x] The notice matches the application's design in light and dark, on desktop and phone.

## Comments

The notice leaves out "signing up keeps it", since there is nothing to sign up with yet: 05 adds that clause, shown only when Clerk is configured, and extends the sweep test with an Account that is spared.
