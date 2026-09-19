import type { TripPlan } from "../../api/types";
import { tripName } from "./naming";
import { tripPastel } from "../../design/tripPastel";

/**
 * A Trip, said in one word and one colour.
 *
 * The colour is the Trip's own, derived from its identity rather than
 * assigned (`design/tripPastel.ts`), which is what lets a traveler see that
 * two Conversations are about one journey without reading either of them. It
 * is the only colour in the application that does not mean one of the four
 * things — it means *this Trip*, and there are as many of them as there are
 * Trips.
 *
 * The name is said as well as coloured. A chip that is only a colour is a
 * colour, and a traveler who cannot tell two pastels apart — or cannot see
 * them at all — is owed the same glance everyone else gets.
 */
export function TripChip({ plan, className = "" }: { plan: TripPlan; className?: string }) {
  const pastel = tripPastel(plan.trip_id);
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-chip border px-2 py-0.5 font-mono text-micro ${className}`}
      style={{
        backgroundColor: pastel.background,
        borderColor: pastel.border,
        color: pastel.ink,
      }}
    >
      {tripName(plan)}
    </span>
  );
}
