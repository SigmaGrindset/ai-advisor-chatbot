import { type ReactNode, useState } from "react";
import { Trash2, UserRoundX, X } from "lucide-react";

import type { ProfileFact } from "../../api/types";
import { smallIcon } from "../../design/icons";
import { factSaid, inReadingOrder, SUBJECT_LABELS } from "./listing";

/**
 * The Traveler Profile, drawn, and the controls that leave nothing behind.
 *
 * Everything the advisor durably knows, in plain language, one fact at a time
 * and each with the way to delete it — what ADR-0001 made the profile a list
 * of facts for, and what ADR-0004 promises.
 *
 * The clear-everything control shares the panel because this is where a
 * traveler comes to ask what is kept about them. It says that it deletes
 * every Conversation and Trip as well. An Account holder finds the way to
 * delete the Account beside it.
 */
export function ProfilePanel({
  profile,
  guest,
  onForget,
  onClear,
  onDeleteAccount,
}: {
  /** Everything the advisor knows, as the server last said it. */
  profile: ProfileFact[];
  /**
   * Whether they are a Guest, whose work also goes after a day without use.
   * Anyone else is signed in to an Account.
   */
  guest: boolean;
  /** Delete one fact, and only that one. */
  onForget: (factId: string) => void;
  /** Delete every Conversation, every Trip, the whole profile and the Advisor Instructions. */
  onClear: () => void;
  /** Delete the Account with all of that, and sign out. Offered only to an Account holder. */
  onDeleteAccount: () => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      {profile.length === 0 ? (
        // The ordinary state of a first visit, so it says what will fill it,
        // and that nothing arrives here they cannot take straight back out.
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
                  a pointer is an affordance a touch screen has not got. */}
              <button
                type="button"
                aria-label={`Delete: ${factSaid(fact)}`}
                className="shrink-0 rounded-control p-1 text-ink-subtle pressable hover:bg-sunken hover:text-ink"
                onClick={() => onForget(fact.id)}
              >
                <X {...smallIcon} aria-hidden="true" />
              </button>
            </div>
          ))}
        </dl>
      )}

      <Erasing guest={guest} onClear={onClear} onDeleteAccount={onDeleteAccount} />
    </div>
  );
}

/**
 * Leaving nothing behind, and for an Account holder, leaving altogether.
 * Each is asked once first, with named controls — the same two-step the
 * Conversation list deletes a row with, this being that decision about
 * everything at once.
 */
function Erasing({
  guest,
  onClear,
  onDeleteAccount,
}: {
  guest: boolean;
  onClear: () => void;
  onDeleteAccount: () => void;
}) {
  const [confirming, setConfirming] = useState<"everything" | "account" | null>(null);

  return (
    <section
      className="flex flex-col gap-3 border-t border-line pt-5"
      onKeyDown={(pressed) => {
        // Escape puts the question away, as it would any other disclosure.
        // Inside the record sheet on a phone the dialog takes the second press.
        if (pressed.key === "Escape" && confirming !== null) {
          pressed.stopPropagation();
          setConfirming(null);
        }
      }}
    >
      <h3 className="font-mono text-micro uppercase text-ink-subtle">Your data</h3>

      {confirming === "everything" && (
        <Confirming
          deleting="Delete everything"
          onConfirm={onClear}
          onClose={() => setConfirming(null)}
        >
          This deletes every conversation, every trip and its plan, everything above and
          your advisor instructions. {!guest && "Your account stays, empty. "}It cannot be
          undone.
        </Confirming>
      )}
      {confirming === "account" && (
        <Confirming
          deleting="Delete account"
          onConfirm={onDeleteAccount}
          onClose={() => setConfirming(null)}
        >
          This deletes your account, and with it every conversation, every trip and its
          plan, everything above and your advisor instructions, then signs you out. It
          cannot be undone.
        </Confirming>
      )}
      {confirming === null && (
        <>
          <p className="text-meta text-ink-subtle">
            Your conversations, your trips and this profile are kept until you delete
            them{guest && ", or until a day passes without you using the application"}.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-control px-1 py-0.5 text-meta text-ink-muted pressable hover:text-error"
              onClick={() => setConfirming("everything")}
            >
              <Trash2 {...smallIcon} aria-hidden="true" />
              Delete everything
            </button>
            {!guest && (
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-control px-1 py-0.5 text-meta text-ink-muted pressable hover:text-error"
                onClick={() => setConfirming("account")}
              >
                <UserRoundX {...smallIcon} aria-hidden="true" />
                Delete account
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** What is about to go, and the two named ways out of the question. */
function Confirming({
  deleting,
  onConfirm,
  onClose,
  children,
}: {
  /** The control that goes ahead, named for what it deletes. */
  deleting: string;
  onConfirm: () => void;
  /** Put the question away, which going ahead does as well. */
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <p className="text-meta text-ink">{children}</p>
      <div className="flex items-center gap-1 text-meta">
        <button
          type="button"
          className="rounded-control px-2 py-1 font-medium text-error underline decoration-1 underline-offset-2"
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          {deleting}
        </button>
        <button
          type="button"
          className="rounded-control px-2 py-1 text-ink-muted underline decoration-1 underline-offset-2"
          onClick={onClose}
        >
          Keep it
        </button>
      </div>
    </>
  );
}
