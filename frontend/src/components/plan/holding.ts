/**
 * The Trip Plan on screen, and everything that revises it.
 *
 * Two writers reach the same plan: the advisor mid-turn, and the traveler by
 * hand. Both arrive here; what happens when they reach for one field at once
 * is `merging.ts`, pure and tested there.
 *
 * Which field is open lives in a ref rather than state, because nothing is
 * drawn from it: this needs the answer only when a patch lands.
 */

import { useRef, useState } from "react";

import type { TripPlan } from "../../api/types";
import { useHighlight } from "./highlighting";
import { merged } from "./merging";

type Held = {
  /** Whose plan this is, so a turn answering into another one cannot land here. */
  conversationId: string | null;
  plan: TripPlan | null;
  /** What the advisor wanted for a field the traveler had open, by field. */
  suggestions: Record<string, string>;
};

const NOTHING: Held = { conversationId: null, plan: null, suggestions: {} };

export type PlanHolding = {
  plan: TripPlan | null;
  /** A suggestion per field the advisor and the traveler reached for at once. */
  suggestions: Record<string, string>;
  /** The fields the advisor changed a moment ago, for as long as they stay lit. */
  lit: ReadonlySet<string>;
  /** A Conversation was opened, or begun: this is the plan it is refining. */
  opened: (conversationId: string | null, plan: TripPlan | null) => void;
  /** The advisor patched the plan mid-turn. */
  revised: (conversationId: string, plan: TripPlan, changed: readonly string[]) => void;
  /** The traveler changed something by hand and the server answered with the whole plan. */
  replaced: (plan: TripPlan) => void;
  /** The traveler opened an editor on a field, or closed the one they had open. */
  editing: (field: string | null) => void;
  /** A suggestion has been taken or let go, and is not to be offered again. */
  settled: (field: string) => void;
};

export function usePlanHolding(): PlanHolding {
  const [held, setHeld] = useState<Held>(NOTHING);
  const editing = useRef<string | null>(null);
  const { lit, light } = useHighlight();

  /**
   * Take a plan that has arrived, keeping whatever the traveler has open. The
   * updater reads the editing ref and folds suggestions in idempotently, so
   * React calling it twice answers the same thing twice.
   */
  function take(conversationId: string, arriving: TripPlan, changed: readonly string[]) {
    setHeld((sofar) => {
      if (sofar.conversationId !== conversationId) return sofar;
      const { plan, suggestions } = merged(sofar.plan, arriving, changed, editing.current);
      return {
        conversationId,
        plan,
        suggestions: suggestions.reduce(
          (sofar, offered) => ({ ...sofar, [offered.field]: offered.value }),
          sofar.suggestions,
        ),
      };
    });
  }

  return {
    plan: held.plan,
    suggestions: held.suggestions,
    lit,

    opened: (conversationId, plan) => {
      editing.current = null;
      setHeld({ conversationId, plan, suggestions: {} });
    },

    revised: (conversationId, plan, changed) => {
      take(conversationId, plan, changed);
      // Everything the patch moved except the field it was not allowed to:
      // lighting that would claim the traveler's own value had changed.
      light(changed.filter((field) => field !== editing.current));
    },

    replaced: (plan) =>
      setHeld((sofar) => ({
        ...sofar,
        // Still through the merge: the answer to a save the traveler made a
        // moment ago can arrive after they have opened the next field.
        plan: merged(sofar.plan, plan, [], editing.current).plan,
      })),

    editing: (field) => {
      editing.current = field;
    },

    settled: (field) =>
      setHeld((sofar) => {
        const { [field]: taken, ...left } = sofar.suggestions;
        return taken === undefined ? sofar : { ...sofar, suggestions: left };
      }),
  };
}
