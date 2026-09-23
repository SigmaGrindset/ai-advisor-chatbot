/**
 * How much of the page a phone is actually showing, and where.
 *
 * A virtual keyboard takes half the screen without resizing anything the CSS
 * can see, so a shell sized in `100dvh` runs on underneath it with the
 * composer — a failure that is invisible from a desktop browser.
 *
 * `window.visualViewport` does know, and says so again whenever the keyboard,
 * the URL bar or a pinch changes it. The shell is given those numbers, and
 * falls back to `100dvh` where they are not on offer.
 */

import { useEffect } from "react";

/** A visual viewport as the browser reports it. */
export type Reading = { height: number; offsetTop: number; scale: number };

/** What to give the shell: how tall it is, and how far down the page it starts. */
export type Showing = { height: number; top: number };

/** How far from 1 a scale can be and still be the traveler not pinching. */
const STILL = 0.01;

/** The tokens the shell is sized and placed by, which this overwrites. */
const HEIGHT = "--spacing-viewport";
const TOP = "--spacing-viewport-top";

/**
 * What the shell should be, or null to leave the stylesheet's answer alone.
 *
 * Null for a browser with nothing to say, and null while pinched in: a
 * magnified page reports a viewport a third of the width, and believing it
 * would reflow to a phone layout under the traveler's fingers.
 */
export function showing(reading: Reading | null): Showing | null {
  if (reading === null) return null;
  if (Math.abs(reading.scale - 1) > STILL) return null;
  // Rounded down, never up: a fraction of a pixel too tall puts the last row
  // of the composer under the keyboard.
  return { height: Math.floor(reading.height), top: Math.floor(reading.offsetTop) };
}

/**
 * Keep the shell the size of what the browser is showing. The offset matters
 * as much as the height: a phone opening its keyboard also scrolls the page up
 * underneath it, leaving a height-only shell with its foot below the fold.
 */
export function useVisibleViewport(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    const apply = () => {
      const fits = showing(viewport);
      if (fits === null) {
        root.style.removeProperty(HEIGHT);
        root.style.removeProperty(TOP);
        return;
      }
      root.style.setProperty(HEIGHT, `${fits.height}px`);
      root.style.setProperty(TOP, `${fits.top}px`);
    };

    apply();
    // Resize is the keyboard and the URL bar; scroll is the page being moved
    // under the visible part, which happens without a resize.
    viewport.addEventListener("resize", apply);
    viewport.addEventListener("scroll", apply);
    return () => {
      viewport.removeEventListener("resize", apply);
      viewport.removeEventListener("scroll", apply);
      root.style.removeProperty(HEIGHT);
      root.style.removeProperty(TOP);
    };
  }, []);
}
