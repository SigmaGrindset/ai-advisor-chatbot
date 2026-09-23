/**
 * Which of the three layouts the window is wide enough for.
 *
 * Asked in TypeScript rather than answered in CSS, because a pane and a sheet
 * are not the same element hidden twice: rendering the list in both and
 * showing whichever the media query allows would give the application two of
 * everything. The shell asks which layout it is in and mounts each thing once.
 *
 * Presentation inside a pane stays in CSS; `layout.test.ts` reads the theme's
 * breakpoints back to keep the two answers in step.
 */

import { useSyncExternalStore } from "react";

/** The narrowest window that shows the Conversation and the record together. */
export const SHEET = 768;

/** The narrowest window that shows all three panes at once. */
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
  // The two widths themselves rather than every resize event: a media query
  // reports exactly when the answer changes and never when it does not.
  const edges = [SHEET, SHELL].map((width) => window.matchMedia(`(min-width: ${width}px)`));
  for (const edge of edges) edge.addEventListener("change", changed);
  return () => {
    for (const edge of edges) edge.removeEventListener("change", changed);
  };
}
