/**
 * A small panel hanging off the control that opened it, and the four ways it
 * goes away again.
 *
 * `anchoring.ts` is where the panel goes; this is everything else about being
 * one. Two places want that now — the actions on a Conversation's row, and the
 * confirmation over a Trip — and the mechanics are not the interesting part of
 * either: a `manual` popover has no dismissal of its own, so every one of them
 * has to be written out, and written out twice they would drift.
 *
 * `manual` rather than `auto` is deliberate. The kind that dismisses itself
 * takes the press that opened it as a press elsewhere, which turns pressing
 * the control a second time into a close followed immediately by a reopen.
 * What that kind would have given for free is given here instead.
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
   * What the panel is saying at the moment. A panel that changes what it asks
   * changes size, so it is placed again and handed the focus again — the
   * control that was under the cursor may no longer be on the page.
   */
  showing?: unknown;
  onClose: () => void;
}): AnchoredPanel {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Where focus goes when the panel opens. `autofocus` cannot do it: the
  // browser applies that while the panel is still `display: none`, which is to
  // say it does not apply it.
  const landing = useRef<HTMLButtonElement>(null);
  // The way out, kept where a listener registered once can still read the
  // current one: closing belongs to whoever owns the panel, and they hand down
  // a new function every render.
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  // Shown, placed, and handed the focus — all before the frame it was opened
  // in is painted, which is what makes this a layout effect. An ordinary one
  // would let the browser paint the panel once where it parks a popover that
  // has not been told where it goes, which is the middle of the window.
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

  // What puts it away: a press anywhere else, and anything that moves the
  // control out from under it. The panel is in the top layer and the control is
  // not, so a list scrolled while this is open would leave the panel hanging
  // over something it is not about. It is closed rather than followed, because
  // a panel chasing a scrolling row is a panel nobody can hit.
  useLayoutEffect(() => {
    if (!open) return;
    const floating = panel.current;

    const away = () => close.current();
    const pressed = (event: PointerEvent) => {
      const at = event.target as Node | null;
      if (at === null) return;
      // The control itself is not "elsewhere". Pressing it again is how the
      // panel is closed, and closing it here as well would leave that press
      // with nothing left to close and a panel that opens straight back up.
      if (floating?.contains(at) === true || trigger.current?.contains(at) === true) return;
      close.current();
    };

    const scrolled = (event: Event) => {
      // Only a scroll that takes the control with it. The transcript scrolls
      // itself every time the advisor writes another line, and a panel the
      // traveler opened should not be closed by something happening in another
      // pane.
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
      // The panel has gone from the page and the browser has dropped focus on
      // the floor with it. Put focus back on the control that opened it —
      // unless the traveler has already put it somewhere themselves, which is
      // what a press on something else was.
      if (document.activeElement === document.body) trigger.current?.focus();
    };
  }, [open]);

  return { trigger, panel, landing };
}
