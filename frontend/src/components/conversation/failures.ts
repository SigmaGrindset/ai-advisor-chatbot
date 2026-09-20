/**
 * What a failed turn is labelled as — the two or three words above the
 * server's sentence. Three of the four say whose problem it is before the
 * sentence is read, which "something went wrong" never does.
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
