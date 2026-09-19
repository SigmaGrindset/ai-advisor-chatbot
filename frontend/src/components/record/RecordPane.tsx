import { useRef, type ReactNode } from "react";
import { MapPinned, UserRound } from "lucide-react";

import { icon } from "../../design/icons";

/**
 * The third pane: the two durable records a Conversation writes to.
 *
 * The Trip Plan is never somewhere the traveler navigates away to — it sits in
 * view and changes as they talk, which is the only way the plan "taking shape
 * as they talk" happens on screen rather than in a claim (ADR-0006). The
 * Traveler Profile shares the pane because it is the other durable thing the
 * conversation writes to, and arrives with the Traveler Profile itself.
 *
 * It draws itself and nothing around itself. Where it goes is the shell's
 * question: a pane on a laptop and a tablet, and a bottom sheet on a phone.
 * Which tab is open is not its own either, because the shell's peek strip
 * opens this pane *at* the plan — so the answer has to be somewhere both can
 * reach.
 */

/** Which of the two records is showing. */
export type RecordTab = "plan" | "traveler";

const TABS = [
  {
    id: "plan",
    label: "Plan",
    glyph: <MapPinned {...icon} aria-hidden="true" />,
    heading: "Trip Plan",
  },
  {
    id: "traveler",
    label: "Traveler",
    glyph: <UserRound {...icon} aria-hidden="true" />,
    heading: "Traveler Profile",
  },
] as const satisfies readonly { id: RecordTab; label: string; glyph: ReactNode; heading: string }[];

export function RecordPane({
  tab,
  onTab,
  unseen,
  switcher,
  plan,
}: {
  tab: RecordTab;
  onTab: (tab: RecordTab) => void;
  /**
   * Whether the Trip Plan has changed since the Plan tab was last showing.
   *
   * The tab is marked rather than switched to. A pane that changed tab under
   * a traveler reading the other one would take away what they were reading
   * to show them something they had not asked for.
   */
  unseen: boolean;
  /**
   * Which Trip the Conversation is refining, and the way to say otherwise. It
   * is the head of the plan rather than part of it: what a plan says is the
   * Trip Plan's business, and which Trip is being shown at all is not.
   */
  switcher: ReactNode;
  /** The Trip Plan, drawn. */
  plan: ReactNode;
}) {
  const tabs = useRef(new Map<RecordTab, HTMLButtonElement>());
  const showing = TABS.find((each) => each.id === tab)!;

  /** Left and right walk the tabs, as a tab list is expected to. */
  function walk(from: RecordTab, step: number) {
    const at = TABS.findIndex((each) => each.id === from);
    const next = TABS[(at + step + TABS.length) % TABS.length]!;
    onTab(next.id);
    tabs.current.get(next.id)?.focus();
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-surface">
      <div
        role="tablist"
        aria-label="Trip details"
        className="flex shrink-0 gap-1 border-b border-line px-3 pt-3"
      >
        {TABS.map((each) => {
          const showingThis = each.id === tab;
          const marked = each.id === "plan" && unseen && !showingThis;
          return (
            <button
              key={each.id}
              type="button"
              role="tab"
              id={`${each.id}-tab`}
              aria-selected={showingThis}
              aria-controls={`${each.id}-panel`}
              tabIndex={showingThis ? 0 : -1}
              ref={(element) => {
                if (element) tabs.current.set(each.id, element);
                else tabs.current.delete(each.id);
              }}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 pt-1.5 pb-2.5 text-meta font-medium transition-colors ${
                showingThis
                  ? "border-accent text-ink"
                  : "border-surface text-ink-muted hover:text-ink"
              }`}
              onClick={() => onTab(each.id)}
              onKeyDown={(pressed) => {
                if (pressed.key === "ArrowRight") walk(each.id, 1);
                else if (pressed.key === "ArrowLeft") walk(each.id, -1);
                else return;
                pressed.preventDefault();
              }}
            >
              {each.glyph}
              {each.label}
              {/* Said as well as drawn: a dot is not a thing a screen reader
                  can report, and "changed" is the whole of what it means. */}
              {marked && (
                <>
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-chip bg-changed"
                  />
                  <span className="sr-only">changed</span>
                </>
              )}
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
        className="flex min-h-0 flex-1 animate-panel flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-6"
      >
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-heading font-semibold text-ink">{showing.heading}</h2>
          {showing.id === "plan" && switcher}
        </div>
        {showing.id === "plan" ? (
          plan
        ) : (
          <p className="text-meta text-ink-subtle">
            What the advisor learns about you is listed here, one fact at a time, and you
            can delete any of them.
          </p>
        )}
      </div>
    </div>
  );
}
