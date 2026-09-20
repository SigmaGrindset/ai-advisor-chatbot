import type { ReactNode } from "react";

import { useVisibleViewport } from "./viewport";

/**
 * The window the application is drawn in.
 *
 * Sized from what the browser says it is showing rather than `100dvh`
 * (`viewport.ts`). Every screen sits inside this one frame, so a page reached
 * by a route gets the same treatment as the shell.
 *
 * It is also the only thing that draws the ground — the canvas and its
 * contour lines (`design/base.css`) — so the map runs under every pane
 * without a seam rather than each printing its own patch.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  useVisibleViewport();

  return (
    <div className="terrain fixed inset-x-0 top-0 flex h-viewport translate-y-viewport-top overflow-hidden pl-safe-left pr-safe-right text-ink">
      {/* The way past the navigation: the rail is read before the
          Conversation, so a keyboard would otherwise tab through every
          Conversation before reaching the open one.
          Parked above the frame rather than hidden with `sr-only`, whose
          utility sets its own padding and position and would bring the link
          back as unstyled text over whatever it landed on. Focus slides it
          down into the corner. */}
      <a
        href="#main"
        className="absolute top-3 left-3 z-10 -translate-y-[300%] rounded-control bg-surface px-4 py-2 text-meta font-medium text-ink shadow-floating transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      {children}
    </div>
  );
}
