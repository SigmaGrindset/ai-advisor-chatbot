/**
 * The shape of something that has not arrived yet.
 *
 * On arrival the application reads the Conversations, the Trips, the profile
 * and the last Conversation worked in, all at once, and until they land every
 * pane holds its empty state: a rail saying "Conversations you start appear
 * here", a transcript greeting a traveler who has been here forty times, a
 * plan saying no trip has been talked about. Then the data lands and all
 * three are replaced. Nothing was broken, but for a moment the application
 * told the traveler three things about their own account that were not true.
 *
 * So the empty state is held back until there is something to be empty about,
 * and what stands in its place is the shape of what is coming. A block per
 * line, at the size and in the position of the line it is standing in for, so
 * that when the real thing arrives it arrives where the eye is already
 * looking rather than reflowing the pane around it.
 *
 * Not a spinner. A spinner says only that something is happening, in the
 * middle of a pane, and then the pane jumps.
 */

/**
 * One block, standing in for one line.
 *
 * Drawn in the hairline colour rather than in `sunken`, because `sunken` is
 * the rail's own background and a block that matches what is behind it is
 * not a block. Hidden from screen readers entirely: the pane it is in has
 * nothing in it yet, and reading out its dimensions is not a report of that.
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
 * What the transcript is holding a place for: a question and the answer to it.
 *
 * Two turns rather than one, at the widths a question and an answer actually
 * run to — a question is a line, an answer is a paragraph — so the block the
 * traveler is looking at while it loads is the block the transcript fills.
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
