/**
 * Which of the three layouts the window is wide enough for.
 *
 * This is asked in TypeScript rather than answered entirely in CSS because a
 * pane and a sheet are not the same element hidden twice. The Conversation
 * list is one component with one piece of state; rendering it in the rail
 * *and* in the sheet and showing whichever the media query allows would give
 * the application two of everything — two tab strips holding two opinions
 * about which tab is open, two live regions, two of every identifier. The
 * shell asks which layout it is in and mounts each thing once.
 *
 * Presentation inside a pane stays in CSS, where it belongs. The two answers
 * are made to agree by `layout.test.ts`, which reads the theme's own
 * breakpoints back.
 */

import { useSyncExternalStore } from "react";

/** The narrowest window that shows the Conversation and the record together. */
export const SHEET = 768;

/** The narrowest window that shows all three panes at once (ADR-0006). */
export const SHELL = 1100;

/**
 * What the shell is showing.
 *
 * - `desktop`: the Conversation list, the Conversation and the record pane.
 * - `tablet`: the Conversation and the record pane, the list as a left sheet.
 * - `phone`: the Conversation, with both of the others as sheets.
 */
export type Layout = "phone" | "tablet" | "desktop";

export function layoutFor(width: number): Layout {
  if (width >= SHELL) return "desktop";
  if (width >= SHEET) return "tablet";
  return "phone";
}

export function useLayout(): Layout {
  return useSyncExternalStore(watchWidth, here, () => "desktop");
}

/** The layout this window is in at the moment of asking. */
function here(): Layout {
  return layoutFor(window.innerWidth);
}

function watchWidth(changed: () => void): () => void {
  // The two widths themselves, rather than every resize event: a media query
  // reports exactly when the answer changes and never when it does not, and
  // it is the one signal a browser is obliged to deliver — a window that is
  // resized without a `resize` event reaching the page still crosses these.
  const edges = [SHEET, SHELL].map((width) => window.matchMedia(`(min-width: ${width}px)`));
  for (const edge of edges) edge.addEventListener("change", changed);
  return () => {
    for (const edge of edges) edge.removeEventListener("change", changed);
  };
}
