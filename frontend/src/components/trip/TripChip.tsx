import type { TripPlan } from "../../api/types";
import { tripName } from "./naming";
import { useTheme } from "../../design/theme";
import { tripPastel } from "../../design/tripPastel";

/**
 * A Trip, said in one word and one colour.
 *
 * The colour is derived from the Trip's identity (`design/tripPastel.ts`), so
 * two Conversations about one journey can be seen to be without reading
 * either. It is the only colour here that means *this Trip* rather than one
 * of the four things.
 *
 * The name is said as well as coloured: a chip that is only a colour is a
 * colour, and not everyone can tell two pastels apart.
 */
export function TripChip({ plan, className = "" }: { plan: TripPlan; className?: string }) {
  const { scheme } = useTheme();
  const pastel = tripPastel(plan.trip_id, scheme);
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
