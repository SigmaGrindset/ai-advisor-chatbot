/**
 * What a failed turn is labelled as.
 *
 * The sentence under the label comes from the server, which is where the
 * provider's answer was read; this is only the two or three words above it.
 * They exist because a traveler reading an error is deciding what to do about
 * it, and "something went wrong" is the one thing that leaves them nowhere:
 * three of these four say whose problem it is before the sentence is read.
 */

import type { FailureKind } from "../../api/types";

const LABELS: Record<FailureKind, string> = {
  configuration: "Not configured",
  credit: "Out of credit",
  upstream: "Provider unavailable",
  application: "Application error",
};

export function failureLabel(kind: FailureKind): string {
  return LABELS[kind];
}
