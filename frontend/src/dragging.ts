/**
 * Carrying a sheet under a thumb.
 *
 * Separated from the sheet itself because it is a different kind of thing: a
 * sheet is a dialog with a panel in it, and this is arithmetic over a stream
 * of pointer positions. Where the sheet comes to rest afterwards is a third
 * thing again, and lives in `snapping.ts`.
 *
 * Everything here speaks in extents — a fraction of the sheet's own size,
 * from 0 for closed to 1 for all of it — so that neither this nor the
 * snapping rule has to know which edge the sheet came in from.
 */

import { useRef, type PointerEvent } from "react";

/**
 * How far back a velocity is measured, in milliseconds.
 *
 * Over the whole drag, a thumb that wandered for a second and then flicked
 * reads as barely moving. Between the last two frames it reads as noise. A
 * window of a few frames is the speed a hand would say it was going.
 */
const RECENTLY = 50;

/** Where a drag began: the thumb's position, and the sheet's. */
type Grip = { along: number; extent: number };

export function useDrag({
  side,
  span,
  where,
  onTake,
  onMove,
  onLet,
}: {
  side: "left" | "bottom";
  /** The sheet's own size in pixels, which is what a thumb moves across. */
  span: () => number;
  /** Where the sheet is now, for a drag that starts part of the way out. */
  where: () => number;
  onTake: () => void;
  onMove: (extent: number) => void;
  /** Let go: where it was let go, and how fast, in extents a second. */
  onLet: (extent: number, velocity: number) => void;
}) {
  // Where the thumb went down, and a sample of where it was a moment ago.
  // Both outside React: a drag is measured between frames, not rendered.
  const from = useRef<Grip | null>(null);
  const sample = useRef({ extent: 0, at: 0 });

  /** How far along the axis the sheet moves, positive towards being open. */
  const along = (event: PointerEvent) => (side === "left" ? event.clientX : -event.clientY);

  /** Where the sheet has been dragged to, for a pointer at this position. */
  const reached = (event: PointerEvent, grip: Grip) =>
    clamp(grip.extent + (along(event) - grip.along) / span());

  return {
    onPointerDown: (pressed: PointerEvent<HTMLElement>) => {
      // Captured, so a thumb that slides off the handle keeps the sheet.
      pressed.currentTarget.setPointerCapture(pressed.pointerId);
      from.current = { along: along(pressed), extent: where() };
      sample.current = { extent: where(), at: pressed.timeStamp };
      onTake();
    },

    onPointerMove: (moved: PointerEvent<HTMLElement>) => {
      const grip = from.current;
      if (grip === null) return;
      const extent = reached(moved, grip);
      if (moved.timeStamp - sample.current.at >= RECENTLY) {
        sample.current = { extent, at: moved.timeStamp };
      }
      onMove(extent);
    },

    onPointerUp: (lifted: PointerEvent<HTMLElement>) => {
      const grip = from.current;
      if (grip === null) return;
      from.current = null;
      const extent = reached(lifted, grip);
      const since = lifted.timeStamp - sample.current.at;
      const velocity = since > 0 ? ((extent - sample.current.extent) / since) * 1000 : 0;
      onLet(extent, Number.isFinite(velocity) ? velocity : 0);
    },

    onPointerCancel: () => {
      if (from.current === null) return;
      from.current = null;
      // A cancelled drag is not a decision, so the sheet is put down where it
      // stands rather than thrown anywhere.
      onLet(where(), 0);
    },
  };
}

function clamp(extent: number): number {
  return Math.min(1, Math.max(0, extent));
}
