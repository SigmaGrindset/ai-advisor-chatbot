/**
 * The shape of something that has not arrived yet.
 *
 * Until the first read lands, every pane's empty state would tell the traveler
 * something about their own account that nothing has checked — a rail saying
 * conversations appear here, a greeting for someone who has been here forty
 * times. So the empty state waits, and the shape of what is coming stands in:
 * a block per line, at the size and place of the line it stands for, so the
 * real thing arrives where the eye already is.
 *
 * Not a spinner, which says only that something is happening and then jumps.
 */

/**
 * One block, standing in for one line. Drawn in the hairline colour rather
 * than `sunken`, which is the rail's own background. Hidden from screen
 * readers: reading out its dimensions is not a report of anything.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-control bg-line ${className}`}
    />
  );
}

/**
 * What the transcript is holding a place for: a question and its answer, at
 * the widths each actually runs to — a line, then a paragraph.
 */
export function LoadingTranscript() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-label="Loading your conversation">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-6 w-3/5" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
