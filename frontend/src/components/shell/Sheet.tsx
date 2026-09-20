import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { icon } from "../../design/icons";
import { useDrag } from "./dragging";
import { resting } from "./snapping";

/**
 * A panel that comes in from an edge over the shell, and the only one.
 *
 * Everything the narrow layouts put away lives in one of these: the
 * Conversation list on a tablet and a phone, the record beside it on a phone,
 * and whatever the tickets after this one have to fold away. The snap points
 * are why it is a primitive rather than three drawers — a sheet with a peek,
 * a half and a whole is the shape ADR-0006 asks the Trip Plan for, and it is
 * not a shape to write twice.
 *
 * It is a `dialog` opened modally, which is deliberate rather than
 * incidental: the browser then owns the focus trap, the Escape key, the
 * inertness of everything behind it, and the return of focus to whatever
 * opened it. A hand-written trap gets one of those four subtly wrong, and the
 * one it gets wrong is only ever found by the traveler who depends on it.
 */
export function Sheet({
  open,
  side,
  label,
  stops = [1],
  opensAt,
  onClose,
  children,
}: {
  open: boolean;
  /** The edge it comes in from. */
  side: "left" | "bottom";
  /** What the sheet is, for anyone who cannot see which one opened. */
  label: string;
  /**
   * Where it is allowed to rest, as fractions of its own size. The default is
   * the one place a drawer has: all the way out.
   */
  stops?: readonly number[];
  /** Which of those it opens at. The default is the furthest out. */
  opensAt?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const frame = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // How much of the sheet is out, from 0 for closed to 1 for all of it. It
  // starts at 0 even when `open` arrives true, so the first frame after the
  // dialog is shown has somewhere to travel from.
  const [extent, setExtent] = useState(0);
  // True only while a thumb is on it, when the sheet has to follow the thumb
  // exactly rather than easing towards anywhere.
  const [dragging, setDragging] = useState(false);

  const furthest = Math.max(...stops);
  const target = opensAt ?? furthest;

  useEffect(() => {
    const dialog = frame.current;
    if (dialog === null) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      // The panel itself rather than a control in it, so a reader is told
      // what has opened before it is told what is inside.
      //
      // Without `preventScroll` the browser brings the panel into view, and
      // at this moment the panel is deliberately off the bottom of the
      // screen waiting to travel up — so bringing it into view scrolls the
      // whole sheet by however far it had left to come, and the sheet then
      // rests at the right size in the wrong place.
      panel.current?.focus({ preventScroll: true });
      // An element displayed and moved in the same breath transitions from
      // nowhere: a transition needs the position it is leaving to have been
      // resolved first, and until `showModal` the panel had no position at
      // all. Reading a layout value resolves it. A frame would do the same
      // job and only when the page is actually being painted, which is not a
      // thing to make a sheet opening depend on.
      void panel.current?.offsetHeight;
      setExtent(target);
      return;
    }

    if (!dialog.open) return;
    setExtent(0);
    // Shut once it has finished leaving, so the traveler watches it go rather
    // than watching it vanish.
    //
    // How long that is, is asked of the panel rather than assumed, because a
    // traveler who has asked for less motion has a sheet that leaves in no
    // time at all — and a fixed wait would hold the page inert behind a sheet
    // that is already gone. `transitionend` closes it sooner where it fires;
    // it does not fire at all for a transition short enough to round away.
    const shut = () => dialog.close();
    const late = window.setTimeout(shut, travelOf(panel.current) + A_FRAME);
    // This panel's own travel, and nothing else's. Every control inside a
    // sheet transitions its colours, and those events bubble: a close button
    // finishing its hover would otherwise shut the sheet mid-flight, which is
    // exactly the vanishing this is here to prevent.
    const left = (finished: TransitionEvent) => {
      if (finished.target === panel.current && finished.propertyName === "transform") shut();
    };
    dialog.addEventListener("transitionend", left);
    return () => {
      window.clearTimeout(late);
      dialog.removeEventListener("transitionend", left);
    };
  }, [open, target]);

  const drag = useDrag({
    side,
    span: () =>
      (side === "left" ? panel.current?.offsetWidth : panel.current?.offsetHeight) || 1,
    where: () => extent,
    onTake: () => setDragging(true),
    onMove: setExtent,
    onLet: (was, velocity) => {
      setDragging(false);
      const settled = resting(was, velocity, stops);
      if (settled === 0) onClose();
      else setExtent(settled);
    },
  });

  // Nothing eases while a thumb is on it: a sheet that lags behind the finger
  // dragging it does not read as a sheet being dragged.
  const following = dragging ? "0ms" : undefined;
  const away = (1 - extent) * 100;

  return (
    <dialog
      ref={frame}
      aria-label={label}
      // The dialog is the whole screen and holds nothing of its own. The
      // scrim and the panel are inside it, so a press beside the panel is an
      // ordinary click on an element rather than a press on a pseudo-element
      // nothing can listen to.
      //
      // Its overflow is clipped rather than hidden. A sheet resting part of
      // the way out leaves the rest of its panel below the screen, and hidden
      // overflow is still *scrollable* overflow: bringing the focused panel
      // into view scrolls the sheet by exactly the distance it had left to
      // travel, and it comes to rest the right size in the wrong place.
      // Clipped overflow cannot be scrolled by anything.
      className="fixed inset-0 m-0 h-viewport max-h-none w-full max-w-none translate-y-viewport-top overflow-clip border-0 bg-transparent p-0 text-ink backdrop:bg-transparent"
      onKeyDown={(pressed) => {
        if (pressed.key !== "Escape") return;
        // Escape is taken here rather than left to the dialog's own close
        // request, for two reasons. The sheet has to leave the way it
        // arrived rather than vanish, and — the one that is a bug otherwise —
        // a close request is the *default action* of this key, which nothing
        // inside the sheet can stand in front of. A row that has its own
        // actions open would put them away and take the whole sheet with
        // them. Stopped here, one press is one thing.
        pressed.preventDefault();
        pressed.stopPropagation();
        onClose();
      }}
      onCancel={(asked) => {
        // Every other way of asking for this to close: a phone's back
        // gesture, a hardware back button, whatever a browser adds next.
        asked.preventDefault();
        onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-scrim transition-opacity duration-[var(--duration-sheet)] ease-panel"
        style={{ opacity: extent, transitionDuration: following }}
        onClick={onClose}
      />

      <div
        ref={panel}
        tabIndex={-1}
        className={`absolute flex flex-col overflow-hidden bg-surface shadow-floating outline-none transition-transform duration-[var(--duration-sheet)] ease-panel ${
          side === "left"
            ? "inset-y-0 left-0 w-[min(20rem,82%)] border-r border-line pl-safe-left"
            : "inset-x-0 bottom-0 rounded-t-panel border-t border-line"
        }`}
        style={{
          transform: side === "left" ? `translateX(-${away}%)` : `translateY(${away}%)`,
          transitionDuration: following,
          // A bottom sheet is as tall as it is ever allowed to be and hangs
          // the rest of itself below the screen, so dragging it up reveals
          // more of one panel rather than growing an empty one.
          height: side === "bottom" ? `${furthest * 100}%` : undefined,
        }}
      >
        {/* The one part of a bottom sheet a drag is taken from. Taking it from
            the body would fight the list inside it, and a sheet that steals a
            scroll is worse than one that has to be gripped. */}
        <div
          className={`relative flex shrink-0 items-center justify-center py-2 ${
            side === "bottom" ? "cursor-grab touch-none" : ""
          }`}
          {...(side === "bottom" ? drag : {})}
        >
          {side === "bottom" && (
            <span aria-hidden="true" className="h-1 w-10 rounded-chip bg-line-strong" />
          )}
          <button
            type="button"
            aria-label={`Close ${label.toLowerCase()}`}
            className="absolute top-1 right-2 rounded-control p-2 text-ink-subtle pressable hover:bg-canvas hover:text-ink"
            onClick={onClose}
          >
            <X {...icon} aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col pb-safe-bottom">{children}</div>
      </div>
    </dialog>
  );
}

/** Long enough after the travel for a last frame of it to have been drawn. */
const A_FRAME = 50;

/** How long this sheet's own travel takes, in milliseconds, as drawn. */
function travelOf(panel: HTMLElement | null): number {
  if (panel === null) return 0;
  // The first duration is the transform's; they are all the same, and a
  // reduced-motion preference has already flattened every one of them.
  return parseFloat(getComputedStyle(panel).transitionDuration) * 1000 || 0;
}
