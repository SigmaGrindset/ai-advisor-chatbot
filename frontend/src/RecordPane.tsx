import { useRef, useState } from "react";
import { MapPinned, UserRound } from "lucide-react";

import { icon } from "./design/icons";

/**
 * The third pane: the two durable records a Conversation writes to.
 *
 * The Trip Plan is never somewhere the traveler navigates away to — it sits in
 * view and changes as they talk, which is the only way the plan "taking shape
 * as they talk" happens on screen rather than in a claim (ADR-0006). The
 * Traveler Profile shares the pane because it is the other durable thing the
 * conversation writes to.
 *
 * Both panels are empty here, and say in one line what will fill them. The
 * records themselves arrive with the Trip Plan and the Traveler Profile.
 *
 * It draws itself and nothing around itself. Where it goes is the shell's
 * question: a pane on a laptop and a tablet, and a bottom sheet on a phone.
 */

const TABS = [
  {
    id: "plan",
    label: "Plan",
    glyph: <MapPinned {...icon} aria-hidden="true" />,
    heading: "Trip Plan",
    empty: "A trip takes shape here as you talk about one — destination, dates and what is still undecided.",
  },
  {
    id: "traveler",
    label: "Traveler",
    glyph: <UserRound {...icon} aria-hidden="true" />,
    heading: "Traveler Profile",
    empty:
      "What the advisor learns about you is listed here, one fact at a time, and you can delete any of them.",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function RecordPane() {
  const [open, setOpen] = useState<TabId>("plan");
  const tabs = useRef(new Map<TabId, HTMLButtonElement>());
  const showing = TABS.find((tab) => tab.id === open)!;

  /** Left and right walk the tabs, as a tab list is expected to. */
  function walk(from: TabId, step: number) {
    const at = TABS.findIndex((tab) => tab.id === from);
    const next = TABS[(at + step + TABS.length) % TABS.length]!;
    setOpen(next.id);
    tabs.current.get(next.id)?.focus();
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-surface">
      <div
        role="tablist"
        aria-label="Trip details"
        className="flex shrink-0 gap-1 border-b border-line px-3 pt-3"
      >
        {TABS.map((tab) => {
          const showingThis = tab.id === open;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${tab.id}-tab`}
              aria-selected={showingThis}
              aria-controls={`${tab.id}-panel`}
              tabIndex={showingThis ? 0 : -1}
              ref={(element) => {
                if (element) tabs.current.set(tab.id, element);
                else tabs.current.delete(tab.id);
              }}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 pt-1.5 pb-2.5 text-meta font-medium transition-colors ${
                showingThis
                  ? "border-accent text-ink"
                  : "border-surface text-ink-muted hover:text-ink"
              }`}
              onClick={() => setOpen(tab.id)}
              onKeyDown={(pressed) => {
                if (pressed.key === "ArrowRight") walk(tab.id, 1);
                else if (pressed.key === "ArrowLeft") walk(tab.id, -1);
                else return;
                pressed.preventDefault();
              }}
            >
              {tab.glyph}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        // Keyed on the tab so switching replaces the panel rather than editing
        // it, which is what gives the transition something to play over.
        key={showing.id}
        role="tabpanel"
        id={`${showing.id}-panel`}
        aria-labelledby={`${showing.id}-tab`}
        tabIndex={0}
        className="flex min-h-0 flex-1 animate-panel flex-col gap-3 overflow-y-auto overscroll-contain px-5 py-6"
      >
        <h2 className="font-display text-heading font-semibold text-ink">{showing.heading}</h2>
        <p className="text-meta text-ink-muted">{showing.empty}</p>
      </div>
    </div>
  );
}
