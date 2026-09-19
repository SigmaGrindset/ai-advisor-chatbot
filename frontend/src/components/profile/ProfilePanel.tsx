import { useState } from "react";
import { Trash2, X } from "lucide-react";

import type { ProfileFact } from "../../api/types";
import { smallIcon } from "../../design/icons";
import { factSaid, inReadingOrder, SUBJECT_LABELS } from "./listing";

/**
 * The Traveler Profile, drawn, and the control that leaves nothing behind.
 *
 * It draws itself and nothing around itself: the tab strip and the heading are
 * the record pane's, and where the pane goes is the shell's.
 *
 * Everything the advisor durably knows is listed here in plain language, one
 * fact at a time, each with the way to delete it — which is the whole of what
 * ADR-0001 made the profile a structured list of facts for, and what ADR-0004
 * promises a traveler who has handed over a nationality and a home city.
 *
 * The clear-everything control shares the panel because this is where a
 * traveler comes to ask what is kept about them. It is not about the profile
 * alone and says so: what it deletes is every Conversation and every Trip as
 * well.
 */
export function ProfilePanel({
  profile,
  onForget,
  onClear,
}: {
  /** Everything the advisor knows, as the server last said it. */
  profile: ProfileFact[];
  /** Delete one fact, and only that one. */
  onForget: (factId: string) => void;
  /** Delete every Conversation, every Trip and the whole profile. */
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      {profile.length === 0 ? (
        // The ordinary state of a first visit, so it says what will fill it —
        // and says up front that nothing arrives here the traveler cannot take
        // straight back out.
        <p className="text-meta text-ink-subtle">
          The advisor has not recorded anything about you yet. As you talk it keeps what
          will still be true of your next trip — your nationality, where you travel from,
          who you travel with — so that you never have to say it twice. Everything it
          keeps is listed here, and you can delete any of it.
        </p>
      ) : (
        <dl className="flex flex-col gap-3">
          {inReadingOrder(profile).map((fact) => (
            <div key={fact.id} className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="font-mono text-micro uppercase text-ink-subtle">
                  {SUBJECT_LABELS[fact.subject]}
                </dt>
                <dd className="text-meta text-ink">{fact.detail}</dd>
              </div>
              {/* Permanently visible rather than revealed by hovering the row:
                  a pointer is an affordance a touch screen has not got
                  (ADR-0007). */}
              <button
                type="button"
                aria-label={`Delete: ${factSaid(fact)}`}
                className="shrink-0 rounded-control p-1 text-ink-subtle transition-colors hover:bg-sunken hover:text-ink"
                onClick={() => onForget(fact.id)}
              >
                <X {...smallIcon} aria-hidden="true" />
              </button>
            </div>
          ))}
        </dl>
      )}

      <Erasing onClear={onClear} />
    </div>
  );
}

/**
 * Leaving nothing behind.
 *
 * Asked once before it happens, with named controls rather than an undo nobody
 * is offered — the same two-step the Conversation list deletes a row with,
 * because this is that decision about everything at once.
 */
function Erasing({ onClear }: { onClear: () => void }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <section
      className="flex flex-col gap-3 border-t border-line pt-5"
      onKeyDown={(pressed) => {
        // Escape puts the question away, as it would any other disclosure.
        // Inside the record sheet on a phone the dialog takes the second press.
        if (pressed.key === "Escape" && confirming) {
          pressed.stopPropagation();
          setConfirming(false);
        }
      }}
    >
      <h3 className="font-mono text-micro uppercase text-ink-subtle">Your data</h3>

      {confirming ? (
        <>
          <p className="text-meta text-ink">
            This deletes every conversation, every trip and its plan, and everything above.
            It cannot be undone.
          </p>
          <div className="flex items-center gap-1 text-meta">
            <button
              type="button"
              className="rounded-control px-2 py-1 font-medium text-error underline decoration-1 underline-offset-2"
              onClick={() => {
                setConfirming(false);
                onClear();
              }}
            >
              Delete everything
            </button>
            <button
              type="button"
              className="rounded-control px-2 py-1 text-ink-muted underline decoration-1 underline-offset-2"
              onClick={() => setConfirming(false)}
            >
              Keep it
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-meta text-ink-subtle">
            Your conversations, your trips and this profile are kept until you delete
            them.
          </p>
          <button
            type="button"
            className="flex items-center gap-1.5 self-start rounded-control px-1 py-0.5 text-meta text-ink-muted transition-colors hover:text-error"
            onClick={() => setConfirming(true)}
          >
            <Trash2 {...smallIcon} aria-hidden="true" />
            Delete everything
          </button>
        </>
      )}
    </section>
  );
}
