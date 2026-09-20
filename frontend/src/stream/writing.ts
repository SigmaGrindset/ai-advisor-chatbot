/**
 * The pace a reply is drawn at, which is not the pace it arrives at.
 *
 * A model does not produce a reply evenly and a network does not deliver it
 * evenly: fragments land in bursts of a couple of hundred characters, better
 * than half a second apart, with nothing in between. Drawn as they arrive,
 * the reply appears in paragraph-sized lumps.
 *
 * So arrival and drawing are separated. What has arrived is a target, and
 * the page walks towards it on the frame clock, holding back far enough that
 * it always has words in hand to draw during the silence between bursts.
 *
 * Three things have to be true for the walk to be invisible, and each is
 * dealt with below:
 *
 *   - the pace must not jump, so it is eased rather than set (`paced`);
 *   - the page must not draw anything it will move or restyle a moment
 *     later, so a reveal only stops where the text has settled (`settled`);
 *   - the reply must not land in one piece at the end, so the Message it
 *     becomes waits for the drawing (`Writing.writing`, and the pane).
 */

import { useEffect, useRef, useState } from "react";

/**
 * How far behind what has arrived the page aims to be, in seconds.
 *
 * This is the cushion the whole thing rests on. Fragments arrive better than
 * half a second apart, and a page holding less than that in hand runs out of
 * words between them and stops — which is a worse thing to watch than the
 * lumps it was meant to cure. Held here, the page always has the best part
 * of a burst still to draw when the next one lands.
 */
export const LAG = 0.7;

/**
 * How long the pace itself takes to change, in seconds.
 *
 * Without this the pace would be set from the backlog every frame, and a
 * burst landing would be a frame that drew two hundred characters followed
 * by frames that drew one. Eased, the pace crosses that whole burst as one
 * unhurried movement — which is the difference between text arriving and
 * something being written.
 */
export const EASE = 0.35;

/**
 * The slowest the page draws while it still has anything left to draw.
 *
 * The easing alone would trail towards a stop as the backlog emptied, which
 * reads as a reply running out of steam. This carries the last of it in at a
 * speed somebody could comfortably read aloud.
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
 * The pace says how far the page has got; this says where it is allowed to
 * stop. Both of the things it refuses to stop at are things the reader would
 * see happen twice:
 *
 * A word drawn letter by letter sits at the end of a line until the letter
 * that no longer fits arrives, and then the whole word drops to the next
 * line. Every line of a reply would do it once. So a reveal stops between
 * words, and a word arrives where it is going to stay.
 *
 * Markdown is worse, because the markers are text until the moment they stop
 * being text: `**Hyde` is drawn as two asterisks and a word, and when `Park**`
 * lands the asterisks vanish, the weight changes and the line reflows. So a
 * marker that has not been closed yet is not drawn, and the phrase it opens
 * arrives whole, bold, in its final place.
 *
 * `more` says whether fragments are still coming. When they have stopped
 * there is nothing left to wait for, and waiting would only hold back the
 * end of a reply that is already complete.
 */
export function settled(text: string, upto: number, more: boolean): number {
  const edge = Math.min(upto, text.length);
  // Nothing more is coming and the page has drawn its way to the end of it,
  // so there is no word still growing and no marker still to be closed. The
  // last word of a reply is drawn here and nowhere else.
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
 * A line the reply has only begun: its markup has arrived and its words have
 * not. Drawn, it is an empty heading or an empty bullet holding a space open
 * for a moment — so it waits for something to be under it.
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
  // An asterisk in ordinary prose — a footnote, a multiplication — is not a
  // marker anybody is going to close, and must not hold the reply up for
  // ever. Only one close behind the edge is worth waiting on.
  return cut - open > REACH ? cut : open;
}

/** A reply being drawn: how much of it is on the page, and whether it is done. */
export type Writing = {
  /** As much of the reply as should be on the page. */
  text: string;
  /**
   * True while a reply is being drawn — including after its last fragment
   * has arrived, for as long as the page is still catching up with it. The
   * Message it became waits on this, so that the last of a reply is written
   * rather than dropped onto the page in one piece.
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
 * Given the reply as it has arrived, and null when none is arriving. What
 * comes back is a prefix of it, which is the same string the reply itself
 * will be a moment later — so everything downstream, from the Markdown
 * parser to the caret, carries on reading one growing reply and knows
 * nothing about any of this.
 */
export function useWriting(arriving: string | null): Writing {
  const [drawn, setDrawn] = useState<Writing>(STILL);
  // What is being drawn and how far the drawing has got. The frame loop reads
  // what has arrived from here rather than closing over it, so that a
  // fragment landing does not tear the loop down and start another — which,
  // with fragments arriving closer together than frames do, could leave it
  // scheduling a frame it never gets to run.
  const held = useRef<Held>({ text: "", at: 0, speed: 0, last: 0 });
  const latest = useRef<string | null>(arriving);
  latest.current = arriving;

  const atOnce = useAtOnce();
  // True from the first fragment until the page has caught up with the last,
  // which is longer than the reply itself takes to arrive. It changes twice
  // per reply, so the loop is started and stopped once.
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
        // A target that does not continue what is on the page is not this
        // reply — it is the next one, or another Conversation's. It starts
        // from the beginning rather than from where the last one got to.
        if (!target.startsWith(reply.text)) {
          reply.at = 0;
          reply.speed = 0;
        }
        reply.text = target;
      }

      // While fragments are still coming the pace eases towards what the
      // backlog asks of it. Once they have stopped it holds what it had, so
      // that the reply runs out at the speed it was being written at instead
      // of easing towards a stop it would never quite reach.
      reply.speed =
        target === null
          ? Math.max(reply.speed, FLOOR)
          : paced(reply.speed, reply.text.length - reply.at, seconds);
      reply.at = Math.min(reply.text.length, reply.at + reply.speed * seconds);

      if (target === null && reply.at >= reply.text.length) {
        // Caught up, and nothing more is coming: the Message this reply
        // became can take the page back.
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

  // A traveler who has asked for less motion is given the reply as it
  // arrives. The pacing is an animation like any other on the page, and this
  // is the preference that says not to run one.
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
