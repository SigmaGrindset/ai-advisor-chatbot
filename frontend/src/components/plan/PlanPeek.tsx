import { MapPinned } from "lucide-react";

import type { TripPlan } from "../../api/types";
import { showRange } from "./dates";
import { smallIcon } from "../../design/icons";

/**
 * The peek state of the plan on a phone: where and when, above the composer.
 *
 * ADR-0006 asks for the plan to be in view at all times, and on a phone the
 * only thing that can be in view at all times beside the conversation is a
 * strip. This is it: destination and dates, where the traveler can see them
 * while they type, and where the highlight still fires where they are looking.
 *
 * It is the way into the sheet rather than the sheet resting at its first
 * snap point. A bottom sheet here is a modal dialog — which is exactly what
 * gives it a focus trap and a working back gesture — and a modal sheet
 * resting permanently over the composer would make the composer unusable,
 * which is the opposite of what a peek state is for.
 *
 * Nothing at all until there is something worth peeking at. A permanent strip
 * saying what will one day be there takes a line of the transcript for
 * nothing, on the screen with none to spare.
 */
export function PlanPeek({
  plan,
  lit,
  onOpen,
}: {
  plan: TripPlan | null;
  /** The fields the advisor changed a moment ago. */
  lit: ReadonlySet<string>;
  onOpen: () => void;
}) {
  if (plan === null) return null;
  const when = showRange(plan.starts_on, plan.ends_on);
  if (plan.destination === null && when === null) return null;

  // Any change at all, not only the two things the strip itself shows. On a
  // phone with the sheet closed this is the only place a change can be
  // noticed: the tab that would otherwise be marked is inside the sheet.
  const changed = lit.size > 0;

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label="Trip Plan. Open the plan."
      className={`flex w-full items-center gap-2 border-b border-line px-4 py-2 text-left transition-colors duration-500 ${
        changed ? "bg-changed-tint" : "bg-surface"
      }`}
      onClick={onOpen}
    >
      <MapPinned {...smallIcon} className="shrink-0 text-ink-subtle" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-meta font-medium text-ink">
        {plan.destination ?? "Destination not decided"}
      </span>
      {when !== null && (
        <span className="shrink-0 font-mono text-micro text-ink-muted">{when}</span>
      )}
    </button>
  );
}
