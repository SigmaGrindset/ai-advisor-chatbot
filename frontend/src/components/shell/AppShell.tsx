import { useEffect, useState, type ReactNode } from "react";

import { useLayout } from "./layout";
import { Sheet } from "./Sheet";

/**
 * How to reach what this width has folded into a sheet, and null for whatever
 * it has left on the page.
 *
 * The controls belong to the shell but are drawn in the Conversation's header,
 * the only thing on a phone with room for them, so the shell hands them to
 * whatever it puts in the middle.
 */
export type Folded = {
  conversations: (() => void) | null;
  record: (() => void) | null;
  /** Drawn where the composer is rather than where the sheet is. */
  peek: ReactNode;
};

/**
 * Three things, and which of them have a pane of their own is the width's
 * decision. On a laptop all three stand side by side; on a tablet the list
 * comes out as a sheet, the record being continuous context where the list is
 * occasional navigation; on a phone only the conversation remains.
 *
 * Each is given here once and put wherever the width has room. Rendering one
 * into both a pane and a sheet and hiding one would be two of everything —
 * two tab strips disagreeing, and two of every identifier on the page.
 */
export function AppShell({
  list,
  conversation,
  record,
  peek,
}: {
  /**
   * Given the way to put the sheet away: one left open over the Conversation
   * they just asked for has to be dismissed before they can read it.
   */
  list: (dismiss: () => void) => ReactNode;
  /** The Conversation itself, which has the middle at every width. */
  conversation: (folded: Folded) => ReactNode;
  /** What the talking is producing. */
  record: ReactNode;
  /** The one line of it that stays in view on a phone, and how to open the rest. */
  peek: (show: () => void) => ReactNode;
}) {
  // One at a time: a sheet is modal, so a second would open over the first
  // with no way back to it.
  const [sheet, setSheet] = useState<"conversations" | "record" | null>(null);
  const layout = useLayout();

  useEffect(() => {
    // A window wide enough for a pane does not need the sheet, which would
    // put a modal scrim over a layout already showing the same thing.
    if (sheet === "conversations" && layout === "desktop") setSheet(null);
    if (sheet === "record" && layout !== "phone") setSheet(null);
  }, [layout, sheet]);

  // Asked once, and read everywhere below rather than the width again: pane
  // and sheet are exact complements, and a pair that drifted would draw the
  // same component twice or leave it off altogether.
  const listed = layout === "desktop";
  const recorded = layout !== "phone";

  const dismiss = () => setSheet(null);
  const listing = list(dismiss);

  return (
    // The panes, in the order they stand. The frame around them is `AppFrame`,
    // which every screen shares.
    <>
      {listed ? (
        <div className="w-rail shrink-0 border-r border-line">{listing}</div>
      ) : null}

      {conversation({
        conversations: listed ? null : () => setSheet("conversations"),
        record: recorded ? null : () => setSheet("record"),
        peek: recorded ? null : peek(() => setSheet("record")),
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
    </>
  );
}

/**
 * Where the record sheet may rest on a phone, as fractions of the screen.
 *
 * Half and whole. The third state, the peek, is not a third number:
 * this sheet is a modal dialog, and one resting permanently over the composer
 * would leave the traveler unable to type. The peek is `PlanPeek`, a strip
 * above the composer, and dragging this sheet down lands back on it.
 */
const RECORD_SNAPS = [0.55, 1] as const;
