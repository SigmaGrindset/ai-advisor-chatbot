# Accounts and Guests

Status: ready-for-agent

## Problem Statement

The application is about to be reachable over the internet, and it still has exactly one
Traveler. Everyone who opens it shares the same Conversations, Trips, Traveler Profile
and Advisor Instructions. One stranger would read another's passport details, and one
stranger's edit to the instructions would change the advisor for everybody. A Traveler
can't keep their work as their own either: it isn't tied to them, only to the one row.

The brief still wants someone who has never been here to be able to just start talking,
with no sign-in required.

## Solution

Every visitor is a **Traveler**. A Traveler who signs in has an **Account**, through Clerk.
Their Conversations, Trips, Traveler Profile and Advisor Instructions are theirs alone and
are waiting for them on any device. A Traveler without one is a **Guest**. For a Guest,
everything works exactly as it does for an Account holder, but all of it is deleted after
24 hours without a request.

A Guest who signs up keeps everything from the visit and stays the same Traveler. A Guest
who signs in to an Account they already have leaves the visit's work behind, and is warned
before signing in. "Delete everything" wipes a Traveler's data and keeps their Account.
A separate "Delete account" removes the data and the Account together.

## User Stories

1. As a Guest, I want to talk to the advisor without signing in, so that I can try it straight away.
2. As a Guest, I want Conversations, Trip Plans, the Traveler Profile and Advisor Instructions to work as they do for an Account holder, so that I am not using a lesser application.
3. As a Guest, I want my work to survive a reload or a second tab, so that I don't lose a plan partway through a visit.
4. As a Guest, I want to be told once, after my first turn, that nothing I do is kept after a day without use, so that its disappearance never surprises me.
5. As a Guest, I want to dismiss that notice for good, so that it doesn't nag.
6. As a Guest whose earlier visit was deleted, I want to see the notice again on my new visit, so that I am reminded each time it applies.
7. As a Guest, I want everything I told the advisor deleted after 24 hours without a request, so that my passport details don't sit on a server.
8. As a Guest, I want "Delete everything" to delete it all right away, so that I don't have to wait a day.
9. As a Guest who has just used "Delete everything", I want an empty application, with my next message starting a fresh visit.
10. As someone who opens the page and leaves, I want nothing stored about me, so that looking costs nothing.
11. As a Guest, I want the Advisor Instructions page to show the default instructions without creating anything, so that reading a page is never a write.
12. As a Guest, I want to edit my own Advisor Instructions without signing in, so that the page stays open as the brief asks.
13. As a Guest whose visit has been deleted, I want the application to open empty rather than broken, so that I can simply start again.
14. As a Guest, I want to sign up and keep every Conversation, Trip, Profile Fact and my Advisor Instructions from this visit, so that signing up doesn't cost me my plan.
15. As a Guest who already has an Account, I want a warning before signing in that this visit's work will be left behind, so that I don't lose it by accident.
16. As a Guest who signs in to an existing Account anyway, I want this visit's work deleted immediately, not left waiting for the sweep.
17. As a Traveler, I want to sign up and sign in through a modal over my Conversation, so that I don't lose my place.
18. As a Traveler, I want the sign-in and sign-up screens to look like the rest of the application, in light and dark, on desktop and phone, so that it feels like one product.
19. As a Traveler on a phone, I want the sign-in screen to behave like the application's other sheets.
20. As a Traveler, I want the sign-in controls at the bottom of the conversation rail, where I already move between things.
21. As an Account holder, I want my Conversations, Trips, Traveler Profile and Advisor Instructions there every time I sign in, from any device.
22. As an Account holder signing in on a new browser, I want my work to appear immediately, with no setup step.
23. As an Account holder, I want no other Traveler able to read or change anything of mine, even by guessing an identifier, so that my details stay mine.
24. As an Account holder, I want my Advisor Instructions to change only my advisor, and nobody else's edits to reach mine.
25. As a Traveler, I want the advisor to know my Traveler Profile, my Trip Plans and the names of my other Conversations, and never another Traveler's.
26. As a Traveler, I want the composed prompt on the instructions page to show my own Profile, Trips and Conversations.
27. As an Account holder, I want signing out to leave an empty application in that browser, so that the next person at the computer sees nothing of mine.
28. As an Account holder, I want everything back when I sign in again after signing out.
29. As an Account holder, I want a request carrying an invalid or expired sign-in to be refused, not quietly treated as a Guest's, so that my work never ends up in a Guest that will be deleted.
30. As an Account holder, I want "Delete everything" to delete my Conversations, Trips, Traveler Profile and Advisor Instructions but keep my Account, so that I can start over without registering again.
31. As a Traveler, I want the "Delete everything" confirmation to say exactly what goes, Advisor Instructions included, and to say whether my Account stays.
32. As an Account holder, I want to delete my Account and all of its data in one step, so that I can leave completely.
33. As an Account holder, I want deleting my Account either to finish completely or to change nothing, so that I'm never left with an Account and no data, or data and no Account.
34. As an Account holder, I want password reset, email verification and protection against guessed passwords, so that my Account is safe.
35. As the operator, I want the application to start and serve Guests when Clerk isn't configured, and to say so, so that a missing key isn't an outage.
36. As the operator, I want the frontend to run on a different host from the backend, so that it can be on Vercel while the backend is elsewhere.
37. As the operator, I want the backend to accept browser requests only from the frontend origins I configure.
38. As the operator, I want expired Guests swept automatically, with no action from me.
39. As the operator, I want nothing stored about an Account apart from Clerk's user ID, so that identity data lives with Clerk and trip data with us.
40. As the operator, I want no Guest token or Clerk token to ever appear in a log.
41. As the operator, I want a fresh database to need nothing created or seeded at startup other than the schema.
42. As the operator, I want account deletion to go only through the application, so that Clerk can never remove a user whose Traveler stays behind.

## Implementation Decisions

**Who is asking**
- Every request resolves to at most one Traveler. The hard-coded sole Traveler and the startup step that creates it go away.
- Every query module that currently reads the sole Traveler takes the Traveler explicitly instead. This covers the Profile, Conversations, Trips and Prompt Versions. The plan and profile tools a turn is given are built for that Traveler.
- The dependency comes in two forms:
  - **For reads:** the Traveler, if there is one. With no Traveler, a read is answered as an empty Traveler: no Conversations, no Trips, an empty Profile, and the default Advisor Instructions composed with nothing around them. A named Conversation or Trip gets a 404.
  - **For writes:** the Traveler, creating a Guest if there isn't one.
- Resolution order:
  - **A valid Clerk session token wins.** If that Clerk user has no Traveler yet, the Guest's Traveler is adopted if the request carries a valid Guest token. The Clerk user ID is set on it and its Guest token cleared. With no Guest token, a new Traveler is created for the Clerk user.
  - **If the Clerk user already has a Traveler and a Guest token also arrives**, the Guest's Traveler is deleted in that request.
  - **A Clerk token that is present but invalid or expired gets a 401.** It never falls back to Guest.
  - **An unknown or swept Guest token is treated as no Guest.** Reads come back empty, and the next write creates a new Guest.

**Guests**
- A Guest is identified by an opaque random **Guest token**. The server keeps only its hash.
- The write that creates the Guest returns the token in a response header. CORS exposes that header.
- The browser keeps the token in local storage and sends it as a request header on every call, the streamed turn included.
- Each request carrying a valid Guest token updates that Guest's last-active time.

**The sweep**
- A plain function that takes "now" and deletes every Traveler with no Account whose last activity is more than 24 hours earlier. Everything they own goes with them on the existing cascades.
- In this spec it runs on an hourly timer started with the application. If the backend host turns out to be serverless, it moves to a cron-triggered entry point when that host is chosen.

**Schema**
- The Traveler gains three columns:
  - a unique, nullable Clerk user ID,
  - a unique, nullable Guest token hash,
  - a last-active timestamp.
- No email address, name or other identity detail is stored.
- There are no migrations. The deployment starts on a fresh database.

**Advisor Instructions**
- They are per Traveler, as the schema already allows.
- Reading them never writes. The shipped default is recorded as a Traveler's first Prompt Version when their first turn is composed, not when the page is read.

**Clerk**
- A **development instance**, by decision, because nothing may cost money apart from the OpenRouter key.
- The frontend uses Clerk's React SDK:
  - a provider configured with the publishable key at build time,
  - sign-in and sign-up buttons that open Clerk's components as a modal,
  - Clerk's user button once signed in.
- **Styling:** every element of those components is styled through Clerk's appearance options using the application's own tokens, in light and dark. Clerk's styles are placed in a cascade layer so the application's utilities win. The development-mode notice is switched off. On a phone, the modal behaves like the application's sheets.
- **Verification:** the backend verifies session tokens offline, against the instance's public key held in settings, and checks the authorized party against the configured frontend origins.
- The browser sends the session token as a bearer `Authorization` header, taken from Clerk on every request.

**Signing in and out**
- A Guest who has written anything is asked for confirmation before Clerk's sign-in opens. Signing up needs no confirmation.
- The first request after signing in carries both tokens and settles adoption or discard. The browser then forgets its Guest token.
- Signing out leaves the browser with no token of either kind, so the application reads as empty.

**Deletion**
- **"Delete everything"** deletes all of a Traveler's data and keeps the Traveler's row identity and Clerk link. The existing approach stays: delete the row so the cascades take everything, then put it straight back, now with the same Clerk user ID. For a Guest it only deletes, and the next write starts a new Guest.
- The "Delete everything" confirmation names the Advisor Instructions. For an Account holder, it also says the Account stays.
- **"Delete account"** is a new endpoint, shown beside "Delete everything" in the Traveler Profile panel. It deletes the Traveler inside a transaction and calls Clerk's Backend API to delete the user through the application's single outbound client. It commits only once Clerk confirms. If Clerk refuses, nothing is deleted and the Traveler is told.
- Clerk's own account deletion is switched off in the Clerk dashboard.

**The one-time Guest notice**
- Shown after a Guest's first completed turn, and dismissed by the Guest.
- The dismissal is remembered in the browser against that Guest's token, so a new Guest sees it again.

**Splitting frontend and backend**
- The frontend reads an API base URL at build time. Empty means same origin, so the combined image still runs locally as it does today.
- The backend allows the configured frontend origins through CORS, with `Authorization` and the Guest token header allowed.
- Settings gain:
  - the Clerk public key and secret key,
  - the allowed frontend origins.
- **Without Clerk configured**, the backend starts, logs that Accounts are unavailable, and serves Guests only. The frontend, built without a publishable key, hides the sign-in controls.

**Logging and prompts**
- **Logging:** neither kind of token is ever logged, following the existing rule that logs carry identifiers and figures, never content.
- **Prompts:** nothing in the advisor's prompt changes. "One traveler, across every conversation they have with you" is true of each Traveler.

## Testing Decisions

- **Only behaviour a Traveler could observe is tested**, through the application's own HTTP API. There are no tests of token hashing, column shapes or module structure, per the repo's testing rule and its preference for a small suite.
- **Seams, three of them existing:**
  - the HTTP API against a real Postgres, as now;
  - the application's settings, which hold a test public key so tests sign their own Clerk session tokens and the real verification runs;
  - the outbound transport fake, which answers Clerk's Backend API the way it already answers the live-data hosts;
  - the new one: the sweep, called directly with a given "now".
- **The test client behaves like a browser.** It keeps any Guest token a response returns and sends it back, so existing tests keep reading as one Traveler with little change.
- **New behaviour covered:**
  - the first write returns a Guest token, and a read without one creates nothing;
  - two Travelers can't see or change each other's Conversations, Trips, Profile or Advisor Instructions, including by identifier;
  - signing up adopts the Guest's work;
  - signing in to an existing Account deletes the Guest's work;
  - an invalid Clerk token gets a 401;
  - "Delete everything" empties an Account and keeps it;
  - "Delete account" removes both, and leaves everything in place when Clerk refuses;
  - the sweep deletes an idle Guest and spares an active Guest and every Account;
  - reading the Advisor Instructions writes nothing.
- **Prior art:**
  - the many-Conversations and Trips suites, for isolation;
  - the Traveler Profile suite, for "Delete everything";
  - the Advisor Instructions suite;
  - the outbound seam suite, for answering a third-party host.
- **The frontend gets no new tests.** Token handling, the Clerk styling, the notice and the sign-in warning are checked by hand.

## Out of Scope

- Rate limiting or spending caps. Guests spend the operator's OpenRouter key with no limit.
- A Clerk production instance and a custom domain.
- Choosing the backend host, and deploying either half.
- Merging a Guest's work into an existing Account.
- Roles, administrators and shared Advisor Instructions.
- Migrations. The deployment starts from a fresh database.
- Storing any identity detail beyond Clerk's user ID.
- Webhooks from Clerk.
- The README.

## Further Notes

- **The brief says "No login or user accounts — keep it simple."** Guests are what keep that true: nobody has to sign in to use any part of the application.
- **Development-instance limits, accepted by decision:**
  - at most 100 Accounts;
  - Accounts can't be moved to a production instance later, so every Account would be lost with it;
  - Clerk describes these instances as not suitable for production workloads;
  - its emails are marked as coming from development.
- **Retention:** a Guest's words, passport details included, stay in plaintext in Postgres for up to about 25 hours after their last request.
- **Manual setup, for a human:**
  - create the Clerk application;
  - switch off user self-deletion;
  - choose the sign-in methods;
  - put the keys and origins into the frontend and backend environments.
- **Documentation:** `CONTEXT.md` already defines Traveler, Account and Guest. `HANDOFF.md`, and the original spec's out-of-scope line about authentication, are updated when this lands. The README is not touched.
