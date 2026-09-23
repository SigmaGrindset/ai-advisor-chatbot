import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { icon } from "../../design/icons";
import { useDrag } from "./dragging";
import { resting } from "./snapping";

/**
 * A panel that comes in from an edge over the shell, and the only one.
 *
 * Everything the narrow layouts put away lives in one of these. The snap
 * points are why it is a primitive rather than three drawers: a sheet with a
 * peek, a half and a whole is the shape the Trip Plan needs.
 *
 * It is a `dialog` opened modally, so the browser owns the focus trap, the
 * Escape key, the inertness behind it and the return of focus — a
 * hand-written trap gets one of those four subtly wrong.
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
  /** Where it may rest, as fractions of its own size. */
  stops?: readonly number[];
  /** Which of those it opens at. The default is the furthest out. */
  opensAt?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const frame = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // How much is out, 0 to 1. Starts at 0 even when `open` arrives true, so the
  // first frame after the dialog is shown has somewhere to travel from.
  const [extent, setExtent] = useState(0);
  // True only while a thumb is on it, when the sheet follows it exactly.
  const [dragging, setDragging] = useState(false);

  const furthest = Math.max(...stops);
  const target = opensAt ?? furthest;

  useEffect(() => {
    const dialog = frame.current;
    if (dialog === null) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      // The panel itself, so a reader is told what has opened before what is
      // inside. `preventScroll` because the panel is deliberately off-screen
      // waiting to travel up: bringing it into view would scroll the sheet by
      // the distance it had left, leaving it the right size in the wrong place.
      panel.current?.focus({ preventScroll: true });
      // A transition needs the position it is leaving to have been resolved,
      // and until `showModal` the panel had none. Reading a layout value
      // resolves it; a frame would work too, but only when actually painting.
      void panel.current?.offsetHeight;
      setExtent(target);
      return;
    }

    if (!dialog.open) return;
    setExtent(0);
    // Shut once it has finished leaving, so the traveler watches it go. How
    // long that takes is asked of the panel rather than assumed: with less
    // motion it leaves at once, and a fixed wait would hold the page inert
    // behind a sheet already gone. `transitionend` closes it sooner where it
    // fires, which it does not for a transition short enough to round away.
    const shut = () => dialog.close();
    const late = window.setTimeout(shut, travelOf(panel.current) + A_FRAME);
    // This panel's own travel and nothing else's: colour transitions inside
    // the sheet bubble, and a close button finishing its hover would
    // otherwise shut the sheet mid-flight.
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

  // Nothing eases while a thumb is on it: a sheet lagging behind the finger
  // does not read as a sheet being dragged.
  const following = dragging ? "0ms" : undefined;
  const away = (1 - extent) * 100;

  return (
    <dialog
      ref={frame}
      aria-label={label}
      // The whole screen, holding the scrim and the panel, so a press beside
      // the panel is an ordinary click rather than one on a pseudo-element.
      // Overflow is clipped rather than hidden: hidden overflow is still
      // *scrollable*, and a part-open sheet would be scrolled into view and
      // come to rest the right size in the wrong place.
      className="fixed inset-0 m-0 h-viewport max-h-none w-full max-w-none translate-y-viewport-top overflow-clip border-0 bg-transparent p-0 text-ink backdrop:bg-transparent"
      onKeyDown={(pressed) => {
        if (pressed.key !== "Escape") return;
        // Taken here rather than left to the dialog's close request: the
        // sheet has to leave the way it arrived, and a close request is this
        // key's *default action*, which nothing inside the sheet can stand in
        // front of — a row putting its own actions away would take the whole
        // sheet with it. Stopped here, one press is one thing.
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
          // As tall as it is ever allowed to be, hanging the rest below the
          // screen, so dragging up reveals more of one panel.
          height: side === "bottom" ? `${furthest * 100}%` : undefined,
        }}
      >
        {/* The one part a drag is taken from: taking it from the body would
            fight the list inside. The hand closes on the grip, which is the
            only acknowledgement a drag gets until the sheet rests. */}
        <div
          className={`relative flex shrink-0 items-center justify-center py-2 ${
            side === "bottom" ? `touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"}` : ""
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
  // The first duration is the transform's; they are all the same, and less
  // motion has already flattened every one of them.
  return parseFloat(getComputedStyle(panel).transitionDuration) * 1000 || 0;
}
