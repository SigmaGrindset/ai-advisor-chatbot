/**
 * The fields of a Trip Plan, read as text and written back from it.
 *
 * A reading in each direction, kept together so the two cannot drift: a field
 * that reads `2400` and saves `2,400` rewrites itself every time it opens.
 *
 * Writing back is conservative. Text that is not a value at all — letters in
 * the party size, half a date mid-entry — is not a request to empty the
 * field, so it patches nothing. Emptying is done by clearing the field.
 */

import { PLAN_FIELDS, type PlanField, type PlanPatch, type TripPlan } from "../../api/types";

export function isScalar(field: string): field is PlanField {
  return (PLAN_FIELDS as readonly string[]).includes(field);
}

/**
 * What a field holds, as text: what an editor opens with and what a
 * suggestion offers. Empty for a field holding nothing, null for one this
 * plan has not got — an Itinerary Item since removed.
 */
export function valueOf(plan: TripPlan, field: string): string | null {
  switch (field) {
    case "destination":
      return plan.destination ?? "";
    case "starts_on":
      return plan.starts_on ?? "";
    case "ends_on":
      return plan.ends_on ?? "";
    case "party_size":
      return plan.party_size === null ? "" : String(plan.party_size);
    case "budget_amount":
      return plan.budget_amount === null ? "" : String(plan.budget_amount);
    case "budget_currency":
      return plan.budget_currency ?? "";
    default:
      return plan.items.find((item) => item.id === field)?.description ?? null;
  }
}

/** A calendar day as the plan keeps one, and as a date field gives one back. */
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What the traveler typed, as a patch of one field — and an empty patch when
 * what they typed is not a value that field could hold.
 */
export function asPatch(field: PlanField, typed: string): PlanPatch {
  const text = typed.trim();
  if (text === "") return { [field]: null };

  switch (field) {
    case "destination":
      return { destination: text };
    case "starts_on":
    case "ends_on":
      return CALENDAR_DAY.test(text) ? { [field]: text } : {};
    case "party_size": {
      const many = Number(text);
      return Number.isInteger(many) && many >= 1 ? { party_size: many } : {};
    }
    case "budget_amount": {
      // A budget typed as 2,400 is a budget of 2400, not a refusal to read it.
      const amount = Number(text.replace(/[\s,]/g, ""));
      return Number.isFinite(amount) && amount >= 0 ? { budget_amount: amount } : {};
    }
    case "budget_currency": {
      const code = text.toUpperCase();
      return /^[A-Z]{3}$/.test(code) ? { budget_currency: code } : {};
    }
  }
}
