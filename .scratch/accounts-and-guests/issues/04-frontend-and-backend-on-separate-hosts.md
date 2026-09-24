# 04: Frontend and backend on separate hosts

**What to build:** the frontend can be served from one host, Vercel in production, and talk to a backend on another. The frontend reads an API base URL at build time. When it's empty the API is on the same origin, so the combined image still runs locally exactly as it does today. The backend allows the configured frontend origins through CORS and accepts both headers a request can carry: `Authorization`, and the Guest token header. It also exposes the Guest token header so the browser can read a newly issued token.

**Blocked by:** 02.

**Status:** closed

- [x] Every call the frontend makes, the streamed turn included, goes to the configured API base URL.
- [x] Settings gain the allowed frontend origins. With none configured, the backend allows no cross-origin requests.
- [x] A request from an origin that isn't allowed is refused by the browser. One from an allowed origin works end to end, including issuing a Guest token and streaming a turn.
- [x] Checked by hand: the Vite dev server on one port against the backend on another, with a Guest created and a turn streamed.
- [x] The combined image with an empty API base URL behaves as before.
- [x] `HANDOFF.md` describes the two ways to run: combined, and split.

## Comments

A first `POST /api/conversations` has no body or custom header, so a browser sends it without asking first: from an origin that isn't allowed it still makes a Guest, whose token the page never sees and the sweep removes. 05's authorized-party check reads the same `frontend_origins`, which the combined image leaves empty though its own origin is the authorized party there: 05 decides how that image names it (not from the `Host` header, which a caller sets).
