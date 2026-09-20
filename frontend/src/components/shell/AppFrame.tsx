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
 *
 * It is also the only thing in the application that draws the ground — the
 * canvas and the contour lines on it (`design/base.css`). Every pane that
 * shows no background of its own is standing on it, which is why the
 * transcript and the pages draw none: the map runs under all of them without
 * a seam, rather than each of them printing its own patch of it.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  useVisibleViewport();

  return (
    <div className="terrain fixed inset-x-0 top-0 flex h-viewport translate-y-viewport-top overflow-hidden pl-safe-left pr-safe-right text-ink">
      {/* The way past the navigation, for whoever cannot point at what they
          want. The rail comes before the Conversation in the document because
          that is the order it is read in, which means a keyboard arriving on
          this page tabs through every Conversation the traveler has ever had
          before it reaches the one they are in. This is the first thing
          focus lands on, and it is invisible until it does. */}
      {/* Parked above the frame rather than hidden with `sr-only`: the utility
          that would bring it back sets its own padding and position, so a link
          styled that way arrives on screen as unstyled text on top of whatever
          it landed over. This one is drawn the whole time and is simply not
          where the window is — and the frame clips it, because the frame is
          `overflow-hidden`. Focus slides it down into the corner. */}
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
