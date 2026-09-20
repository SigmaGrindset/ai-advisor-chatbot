/**
 * Which parts of the Trip Plan the advisor has just changed.
 *
 * A field that moved without saying so is one the traveler has to go and
 * find, so a changed field lights and fades — long enough to catch an eye on
 * the conversation, short enough not to leave a christmas tree. Under reduced
 * motion the fade goes with every other transition; the traveler is still told.
 */

import { useEffect, useRef, useState } from "react";

/** How long a changed field stays lit, in milliseconds. */
export const LIT = 2600;

export type Highlight = {
  /** The fields lit right now, named as the plan names them. */
  lit: ReadonlySet<string>;
  /** Light these, each for its own `LIT` from now. */
  light: (fields: readonly string[]) => void;
};

export function useHighlight(): Highlight {
  const [lit, setLit] = useState<ReadonlySet<string>>(() => new Set());
  // One timer per field rather than per batch: a shared one would put the
  // second of two patches out early.
  const fading = useRef(new Map<string, number>());

  useEffect(
    () => () => {
      for (const timer of fading.current.values()) window.clearTimeout(timer);
      fading.current.clear();
    },
    [],
  );

  function light(fields: readonly string[]) {
    if (fields.length === 0) return;
    setLit((sofar) => new Set([...sofar, ...fields]));
    for (const field of fields) {
      const running = fading.current.get(field);
      if (running !== undefined) window.clearTimeout(running);
      fading.current.set(
        field,
        window.setTimeout(() => {
          fading.current.delete(field);
          setLit((sofar) => {
            const left = new Set(sofar);
            left.delete(field);
            return left;
          });
        }, LIT),
      );
    }
  }

  return { lit, light };
}
