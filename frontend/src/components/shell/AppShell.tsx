import { useEffect, useState, type ReactNode } from "react";

import { useLayout } from "./layout";
import { Sheet } from "./Sheet";
import { useVisibleViewport } from "./viewport";

/**
 * How to reach what this width has folded into a sheet, and null for whatever
 * it has left on the page.
 *
 * The controls that open the sheets are the shell's, but they are drawn in
 * the Conversation's header, which is the only thing on a phone with room for
 * them. So the shell hands them to whatever it puts in the middle rather than
 * drawing them itself.
 */
export type Folded = {
  conversations: (() => void) | null;
  record: (() => void) | null;
};

/**
 * Three things, and which of them have a pane of their own is the width's
 * decision: what the traveler has talked about, what they are talking about,
 * and what the talking is producing. On a laptop all three stand side by
 * side; on a tablet the list comes out as a sheet, because the record is
 * continuous context and the list is occasional navigation (ADR-0006); on a
 * phone the conversation has the screen and the other two are sheets.
 *
 * Each of them is given here once, and this puts it in whichever place the
 * width has for it. A component rendered into both a pane and a sheet and
 * hidden in one of them would be two of everything — two tab strips
 * disagreeing about which tab is open, and two of every identifier on the
 * page.
 */
export function AppShell({
  list,
  conversation,
  record,
}: {
  /**
   * The Conversation list. It is given the way to put the sheet away, because
   * a traveler who has picked something out of the list has finished with it:
   * a sheet left open over the Conversation they just asked for is a sheet
   * they have to dismiss before they can read it.
   */
  list: (dismiss: () => void) => ReactNode;
  /** The Conversation itself, which has the middle at every width. */
  conversation: (folded: Folded) => ReactNode;
  /** What the talking is producing. */
  record: ReactNode;
}) {
  // Which sheet is out, and null when none is. One at a time: a sheet is
  // modal, so a second one would open over the first with no way back to it.
  const [sheet, setSheet] = useState<"conversations" | "record" | null>(null);
  const layout = useLayout();

  // The shell is sized from what the browser says it is showing rather than
  // from `100dvh`, so a virtual keyboard cannot push the composer off the
  // bottom of the screen.
  useVisibleViewport();

  useEffect(() => {
    // A window widened until it has a pane for what is in the sheet does not
    // need the sheet, and leaving it out would put a modal scrim over a
    // layout that is showing the same thing behind it.
    if (sheet === "conversations" && layout === "desktop") setSheet(null);
    if (sheet === "record" && layout !== "phone") setSheet(null);
  }, [layout, sheet]);

  // Whether each of the two has a pane of its own at this width, asked once.
  // Every place below reads one of these rather than the width again: the
  // pane and the sheet are exact complements, and a pair that drifted would
  // put the same component on the page twice or leave it off altogether.
  const listed = layout === "desktop";
  const recorded = layout !== "phone";

  const dismiss = () => setSheet(null);
  const listing = list(dismiss);

  return (
    // Fixed rather than flowed, and sized from `--spacing-viewport`: a phone
    // with its keyboard open is showing less of the page than any stylesheet
    // can be told about, and `viewport.ts` is what knows how much.
    <div className="fixed inset-x-0 top-0 flex h-viewport translate-y-viewport-top overflow-hidden bg-canvas pl-safe-left pr-safe-right text-ink">
      {listed ? (
        <div className="w-rail shrink-0 border-r border-line">{listing}</div>
      ) : null}

      {conversation({
        conversations: listed ? null : () => setSheet("conversations"),
        record: recorded ? null : () => setSheet("record"),
      })}

      {recorded ? (
        <aside
          className={`shrink-0 border-l border-line ${
            layout === "desktop" ? "w-aside" : "w-aside-tight"
          }`}
        >
          {record}
        </aside>
      ) : null}

      <Sheet
        open={sheet === "conversations"}
        side="left"
        label="Conversations"
        onClose={dismiss}
      >
        {listed ? null : listing}
      </Sheet>

      <Sheet
        open={sheet === "record"}
        side="bottom"
        label="Trip details"
        stops={RECORD_SNAPS}
        opensAt={RECORD_SNAPS[0]}
        onClose={dismiss}
      >
        {recorded ? null : record}
      </Sheet>
    </div>
  );
}

/**
 * Where the record sheet is allowed to rest on a phone, as fractions of the
 * screen.
 *
 * Half and whole, and no peek. ADR-0006's peek state is meant to hold the
 * destination and the dates in view while the traveler types, and there is no
 * Trip Plan to put in it until 09 — a permanent strip saying what will one
 * day be there would take a line of the transcript away for nothing. 09 adds
 * the third number to this array and the sheet keeps working.
 */
const RECORD_SNAPS = [0.55, 1] as const;
