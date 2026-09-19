/**
 * Which page the address bar is on, and how to move between them.
 *
 * Almost nothing in this application is a page. The Trip Plan is deliberately
 * not one (ADR-0006), and the Conversation and its list are panes of one
 * screen. What is left is the handful of things that are genuinely elsewhere:
 * every Trip in one place, and the Advisor Instructions after it.
 *
 * They are real addresses rather than a piece of state, because the traveler
 * can be *at* one of them — a reload, a bookmark and the back button all have
 * to land where they were. The application is served with a fallback to
 * `index.html` on any path the API does not claim, which is what makes that
 * work (`backend/app/frontend.py`).
 *
 * The routes themselves are a closed set rather than a table of patterns: two
 * addresses need no router, and one written here is a page that exists.
 * ADR-0012 is what a page is allowed to be, and why this is not a library.
 */

import { useSyncExternalStore } from "react";

/**
 * Where the traveler is.
 *
 * - `conversations`: the application itself — the list, the Conversation and
 *   the record beside it.
 * - `trips`: every Trip the traveler is planning.
 * - `instructions`: the Advisor Instructions, and the prompt they compose into.
 */
export type Route = "conversations" | "trips" | "instructions";

const PATHS = { conversations: "/", trips: "/trips", instructions: "/instructions" } as const;

/** The address of a page, which is what a link to it points at. */
export function pathFor(route: Route): string {
  return PATHS[route];
}

/**
 * Which page an address names. Anything else is the application itself: a
 * path nobody wrote a page for is a traveler who should still arrive
 * somewhere they can use, not a blank screen apologising.
 */
export function routeFor(path: string): Route {
  // A trailing slash is the same address. Browsers and people both add one.
  const address = path.replace(/\/+$/, "");
  if (address === PATHS.trips) return "trips";
  if (address === PATHS.instructions) return "instructions";
  return "conversations";
}

/** Go to a page, leaving the one behind it in the history to come back to. */
export function goTo(route: Route): void {
  const path = pathFor(route);
  if (path === window.location.pathname) return;
  window.history.pushState(null, "", path);
  // `pushState` fires nothing of its own — `popstate` is the browser going
  // back, not the page going anywhere — so the move is announced here.
  window.dispatchEvent(new Event(MOVED));
}

/** The page being shown, as the address bar has it. */
export function useRoute(): Route {
  return useSyncExternalStore(watchAddress, here, () => "conversations");
}

const MOVED = "routed";

function here(): Route {
  return routeFor(window.location.pathname);
}

function watchAddress(changed: () => void): () => void {
  window.addEventListener("popstate", changed);
  window.addEventListener(MOVED, changed);
  return () => {
    window.removeEventListener("popstate", changed);
    window.removeEventListener(MOVED, changed);
  };
}
