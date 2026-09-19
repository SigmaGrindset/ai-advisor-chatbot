import type { ReactNode } from "react";

import { useVisibleViewport } from "./viewport";

/**
 * The window the application is drawn in.
 *
 * Fixed and sized from what the browser says it is actually showing rather
 * than from `100dvh`: a phone with its keyboard open is showing less of the
 * page than any stylesheet can be told about, and `viewport.ts` is what knows
 * how much. Every screen sits inside this one frame, so a page reached by a
 * client-side route gets the same treatment as the shell does — a composer
 * that survives a keyboard is no use on one screen and not the other.
 *
 * It is a flex row, and what it holds arranges itself in it: the shell's
 * panes, or a page.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  useVisibleViewport();

  return (
    <div className="fixed inset-x-0 top-0 flex h-viewport translate-y-viewport-top overflow-hidden bg-canvas pl-safe-left pr-safe-right text-ink">
      {children}
    </div>
  );
}
