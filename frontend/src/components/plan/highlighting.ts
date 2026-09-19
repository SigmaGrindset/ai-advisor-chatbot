/**
 * Which parts of the Trip Plan the advisor has just changed.
 *
 * The plan changes while the traveler is reading it, and a field that moved
 * without saying so is a field they have to go and find. So a changed field
 * lights up and fades — long enough to catch an eye that was on the
 * conversation, short enough that the plan is not a christmas tree a minute
 * later. Under a reduced-motion preference the fade is suppressed with every
 * other transition and the field simply appears lit and then is not; the
 * traveler is still told.
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
  // One timer per field rather than one for the batch: two patches a second
  // apart are two things to notice, and a shared timer would put the second
  // one out early.
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
