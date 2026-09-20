import { MapPinned } from "lucide-react";

import type { TripPlan } from "../../api/types";
import { showRange } from "./dates";
import { smallIcon } from "../../design/icons";

/**
 * The peek state of the plan on a phone: where and when, above the composer.
 *
 * ADR-0006 asks for the plan to stay in view, and a strip is the only thing
 * that can on a phone — where they see it while typing, and where the
 * highlight fires where they are looking.
 *
 * The way *into* the sheet rather than the sheet at its first snap point: a
 * bottom sheet here is a modal dialog, and one resting permanently over the
 * composer would make the composer unusable.
 *
 * Nothing at all until there is something worth peeking at.
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

  // Any change, not only the two things the strip shows: with the sheet
  // closed this is the only place one can be noticed.
  const changed = lit.size > 0;

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label="Trip Plan. Open the plan."
      className={`flex w-full items-center gap-2 border-b border-line px-4 py-2 text-left transition-colors duration-500 active:translate-y-px ${
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
