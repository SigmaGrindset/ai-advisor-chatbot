/**
 * The pace a reply is drawn at, which is not the pace it arrives at.
 *
 * Fragments land in bursts a couple of hundred characters long, better than
 * half a second apart. Drawn as they arrive, a reply appears in lumps — so
 * what has arrived is a target the page walks towards on the frame clock,
 * holding back far enough to always have words in hand.
 *
 * Three things keep the walk invisible: the pace is eased rather than set
 * (`paced`); a reveal only stops where the text has settled (`settled`); and
 * the Message the reply becomes waits for the drawing (`Writing.writing`).
 */

import { useEffect, useRef, useState } from "react";

/**
 * How far behind what has arrived the page aims to be, in seconds. The
 * cushion the whole thing rests on: holding less than the gap between bursts
 * means running out of words and stopping, which is worse than the lumps.
 */
export const LAG = 0.7;

/**
 * How long the pace itself takes to change, in seconds. Unsmoothed, a burst
 * landing would draw two hundred characters in one frame and one in the next.
 */
export const EASE = 0.35;

/**
 * The slowest the page draws while anything is left. Easing alone would trail
 * towards a stop, which reads as a reply running out of steam.
 */
export const FLOOR = 40;

/** How far back from the edge an unclosed marker is still waited on. */
const REACH = 60;

/** The pace after `seconds` more of easing towards what the backlog asks. */
export function paced(speed: number, behind: number, seconds: number): number {
  const wanted = Math.max(FLOOR, behind / LAG);
  // Eased in seconds rather than per frame, so the same curve is drawn on a
  // slow machine as on a fast one.
  return wanted + (speed - wanted) * Math.exp(-seconds / EASE);
}

/**
 * How much of what has arrived can be drawn without taking any of it back.
 *
 * The pace says how far the page has got; this says where it may stop. It
 * refuses two places the reader would see something happen twice: mid-word,
 * where the word drops to the next line once the letter that no longer fits
 * arrives; and inside an unclosed Markdown marker, where `**Hyde` is two
 * asterisks and a word until `Park**` lands and the whole line reflows.
 *
 * `more` says whether fragments are still coming. Once they stop there is
 * nothing to wait for, and waiting would only hold back a finished reply.
 */
export function settled(text: string, upto: number, more: boolean): number {
  const edge = Math.min(upto, text.length);
  // Nothing more is coming and the page has caught up, so no word is still
  // growing and no marker is still to be closed.
  if (!more && edge >= text.length) return text.length;
  const cut = betweenWords(text, edge);
  if (!more) return cut;
  return beforeAnOpenMarker(text, beforeABegunLine(text, cut));
}

/** Back to just after the last whitespace, so no word is drawn part-written. */
function betweenWords(text: string, upto: number): number {
  let at = upto;
  while (at > 0 && !/\s/.test(text[at - 1]!)) at -= 1;
  return at;
}

/**
 * A line whose markup has arrived and whose words have not. Drawn, it is an
 * empty heading or bullet holding a space open, so it waits.
 */
const BEGUN = /(?:^|\n)[ \t]*(?:[#>*+\-=~`]+|\d+[.)])[ \t]*$/;

function beforeABegunLine(text: string, cut: number): number {
  const begun = BEGUN.exec(text.slice(0, cut));
  return begun === null ? cut : begun.index;
}

/**
 * Inline spans that have been closed, which are the ones with nothing left to
 * wait for. Masking them leaves only the markers that are still open.
 */
const CLOSED = /\*\*[\s\S]+?\*\*|\*[^*\n]+\*|`[^`\n]*`|\[[^\]\n]*\]\([^)\s]*\)/g;

function beforeAnOpenMarker(text: string, cut: number): number {
  const masked = text.slice(0, cut).replace(CLOSED, (span) => " ".repeat(span.length));
  let open = Math.max(masked.lastIndexOf("*"), masked.lastIndexOf("`"), masked.lastIndexOf("["));
  if (open === -1) return cut;
  // `**` is two characters and both of them are the marker.
  while (open > 0 && masked[open - 1] === masked[open]) open -= 1;
  // An asterisk in ordinary prose is not a marker anybody will close, so only
  // one close behind the edge is worth waiting on.
  return cut - open > REACH ? cut : open;
}

/** A reply being drawn: how much of it is on the page, and whether it is done. */
export type Writing = {
  text: string;
  /**
   * True while the page is still catching up, which outlasts the last
   * fragment. The Message the reply became waits on this, so its end is
   * written rather than dropped onto the page in one piece.
   */
  writing: boolean;
};

/** Nothing being drawn, as one value, so a still page stops re-rendering. */
const STILL: Writing = { text: "", writing: false };

/** The reply being drawn, as the frame loop keeps it between frames. */
type Held = { text: string; at: number; speed: number; last: number };

/**
 * As much of the arriving reply as should be on the page this frame.
 *
 * What comes back is a prefix of what arrived — the same string the reply
 * will be a moment later — so everything downstream carries on reading one
 * growing reply and knows nothing about any of this.
 */
export function useWriting(arriving: string | null): Writing {
  const [drawn, setDrawn] = useState<Writing>(STILL);
  // The frame loop reads what has arrived from here rather than closing over
  // it, so a landing fragment does not tear the loop down and start another.
  const held = useRef<Held>({ text: "", at: 0, speed: 0, last: 0 });
  const latest = useRef<string | null>(arriving);
  latest.current = arriving;

  const atOnce = useAtOnce();
  // Changes twice per reply, so the loop is started and stopped once.
  const busy = !atOnce && (arriving !== null || drawn.writing);

  useEffect(() => {
    if (!busy) return;

    const reply = held.current;
    reply.last = performance.now();
    let frame = requestAnimationFrame(function step(now: number) {
      const seconds = (now - reply.last) / 1000;
      reply.last = now;

      const target = latest.current;
      if (target !== null) {
        // A target that does not continue what is on the page is a different
        // reply, so it starts from the beginning.
        if (!target.startsWith(reply.text)) {
          reply.at = 0;
          reply.speed = 0;
        }
        reply.text = target;
      }

      // While fragments come the pace eases towards the backlog; once they
      // stop it holds, so the reply runs out at the speed it was written at.
      reply.speed =
        target === null
          ? Math.max(reply.speed, FLOOR)
          : paced(reply.speed, reply.text.length - reply.at, seconds);
      reply.at = Math.min(reply.text.length, reply.at + reply.speed * seconds);

      if (target === null && reply.at >= reply.text.length) {
        // Caught up: the Message this reply became can take the page back.
        setDrawn(STILL);
        return;
      }
      const cut = settled(reply.text, Math.floor(reply.at), target !== null);
      const text = reply.text.slice(0, cut);
      setDrawn((was) => (was.writing && was.text === text ? was : { text, writing: true }));
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [busy]);

  // The pacing is an animation like any other, so less motion means no pacing.
  if (atOnce) return arriving === null ? STILL : { text: arriving, writing: true };
  return drawn;
}

/** Whether the traveler has asked for less motion, as it stands right now. */
function useAtOnce(): boolean {
  // Made here rather than at the top of the module, which is read in Node by
  // the tests, where there is no window to ask.
  const [asking] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)"));
  const [asked, setAsked] = useState(() => asking.matches);
  useEffect(() => {
    const changed = () => setAsked(asking.matches);
    asking.addEventListener("change", changed);
    return () => asking.removeEventListener("change", changed);
  }, [asking]);
  return asked;
}
