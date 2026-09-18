/**
 * How much of the page a phone is actually showing, and where.
 *
 * `100dvh` is the tallest a stylesheet can be told the window is, and on a
 * phone it is frequently wrong: a virtual keyboard takes half the screen and
 * takes it without resizing anything the CSS can see. A shell sized in `dvh`
 * therefore runs on underneath the keyboard, taking the composer with it —
 * which is the exact failure ADR-0007 names as invisible from a resized
 * desktop browser.
 *
 * The browser does know. `window.visualViewport` reports the part of the page
 * the traveler can see, and reports it again whenever the keyboard, the URL
 * bar or a pinch changes it. The shell is given those numbers instead, and
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
 * What the shell should be, or null to leave the stylesheet's own answer alone.
 *
 * Null for a browser with nothing to say, and null while the traveler is
 * pinched in: a magnified page reports a viewport a third of the width, and a
 * shell that believed it would reflow to a phone layout under their fingers.
 */
export function showing(reading: Reading | null): Showing | null {
  if (reading === null) return null;
  if (Math.abs(reading.scale - 1) > STILL) return null;
  // Rounded down, never up. A fraction of a pixel too tall puts the last row
  // of the composer under the keyboard, which is the whole failure this is
  // here to prevent.
  return { height: Math.floor(reading.height), top: Math.floor(reading.offsetTop) };
}

/**
 * Keep the shell the size of what the browser is showing, for as long as the
 * application is mounted.
 *
 * The offset matters as much as the height. A phone opening its keyboard also
 * scrolls the page up underneath it, so a shell that tracked only the height
 * would be the right size in the wrong place, with its foot below the fold.
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
