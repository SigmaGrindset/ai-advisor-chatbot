/**
 * Which page the address bar is on, and how to move between them.
 *
 * Almost nothing here is a page: the Trip Plan deliberately is not (ADR-0006),
 * and the Conversation and its list are panes of one screen. What is left is
 * genuinely elsewhere — every Trip, and the Advisor Instructions.
 *
 * Real addresses rather than state, because a reload, a bookmark and the back
 * button all have to land where the traveler was (`backend/app/frontend.py`
 * serves the fallback that makes it work).
 *
 * A closed set rather than a table of patterns: two addresses need no router
 * (ADR-0012).
 */

import { useSyncExternalStore } from "react";

/** Where the traveler is. `conversations` is the application itself. */
export type Route = "conversations" | "trips" | "instructions";

const PATHS = { conversations: "/", trips: "/trips", instructions: "/instructions" } as const;

/** The address of a page, which is what a link to it points at. */
export function pathFor(route: Route): string {
  return PATHS[route];
}

/**
 * Which page an address names. Anything else is the application itself: a
 * path nobody wrote a page for should still arrive somewhere usable.
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
  // `pushState` fires nothing of its own, so the move is announced here.
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
