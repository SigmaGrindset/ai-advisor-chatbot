/**
 * A small panel hanging off the control that opened it, and the four ways it
 * goes away again. `anchoring.ts` is where it goes; this is the rest.
 *
 * `manual` rather than `auto`: the kind that dismisses itself takes the press
 * that opened it as a press elsewhere, turning a second press on the control
 * into a close followed immediately by a reopen. What `auto` would have given
 * for free is written out here instead, once rather than per caller.
 */

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

import { anchored } from "./anchoring";

/** Where to hang the panel, what to draw it in, and what to focus inside it. */
export type AnchoredPanel = {
  /** The control the panel hangs off, which is also where focus returns. */
  trigger: RefObject<HTMLButtonElement | null>;
  /** The panel itself, which must carry `popover="manual"`. */
  panel: RefObject<HTMLDivElement | null>;
  /** What takes the focus when the panel opens, and again when it changes. */
  landing: RefObject<HTMLButtonElement | null>;
};

export function useAnchoredPanel({
  open,
  showing,
  onClose,
}: {
  open: boolean;
  /**
   * What the panel is saying at the moment. One that changes what it asks
   * changes size, so it is placed and focused again — the control that was
   * under the cursor may no longer be on the page.
   */
  showing?: unknown;
  onClose: () => void;
}): AnchoredPanel {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // `autofocus` cannot do this: the browser applies it while the panel is
  // still `display: none`, which is to say it does not apply it.
  const landing = useRef<HTMLButtonElement>(null);
  // Kept where a listener registered once can still read the current one: the
  // owner hands down a new function every render.
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  // Shown, placed and focused before the frame is painted, hence a layout
  // effect: an ordinary one would let the browser paint it once in the middle
  // of the window, where it parks a popover not yet told where to go.
  useLayoutEffect(() => {
    const floating = panel.current;
    const control = trigger.current;
    if (floating === null || control === null) return;

    if (!floating.matches(":popover-open")) floating.showPopover();
    const place = anchored(control.getBoundingClientRect(), floating.getBoundingClientRect(), {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    floating.style.top = `${place.top}px`;
    floating.style.left = `${place.left}px`;
    landing.current?.focus();
  }, [open, showing]);

  // What puts it away: a press elsewhere, and anything that moves the control
  // out from under it. The panel is in the top layer and the control is not,
  // so a scrolled list would leave it hanging over something else. Closed
  // rather than followed: a panel chasing a row is one nobody can hit.
  useLayoutEffect(() => {
    if (!open) return;
    const floating = panel.current;

    const away = () => close.current();
    const pressed = (event: PointerEvent) => {
      const at = event.target as Node | null;
      if (at === null) return;
      // The control itself is not "elsewhere": pressing it again is how the
      // panel closes, and closing here too would reopen it.
      if (floating?.contains(at) === true || trigger.current?.contains(at) === true) return;
      close.current();
    };

    const scrolled = (event: Event) => {
      // Only a scroll that takes the control with it: the transcript scrolls
      // itself every time the advisor writes a line.
      const what = event.target as Node | null;
      if (what === null || what.contains(trigger.current)) close.current();
    };

    document.addEventListener("pointerdown", pressed, true);
    window.addEventListener("resize", away);
    // Captured, because what scrolls is the list the control is in, and a
    // scroll does not bubble as far as the window.
    window.addEventListener("scroll", scrolled, true);
    return () => {
      document.removeEventListener("pointerdown", pressed, true);
      window.removeEventListener("resize", away);
      window.removeEventListener("scroll", scrolled, true);
      // The browser dropped focus on the floor with the panel. Put it back on
      // the control, unless the traveler has already put it somewhere.
      if (document.activeElement === document.body) trigger.current?.focus();
    };
  }, [open]);

  return { trigger, panel, landing };
}
