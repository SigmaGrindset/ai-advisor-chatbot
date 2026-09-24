import { Show, UNSAFE_PortalProvider, UserButton, useClerk } from "@clerk/react";
import { LogIn } from "lucide-react";
import { useRef, useState } from "react";

import { guestHasWritten } from "../../api/client";
import { smallIcon } from "../../design/icons";

/**
 * Signing up and signing in, and once signed in, Clerk's own button for the
 * Account in their place.
 *
 * Both open Clerk's screens over the Conversation rather than going to a page
 * of their own, so nothing half-written is lost on the way there and back.
 * Neither shows until Clerk has said whether anyone is signed in.
 *
 * Signing in to an Account they already have leaves a Guest's work behind, so
 * a Guest who has written anything is asked first, and pointed at signing up,
 * which keeps it. Signing up is never asked about: it loses nothing.
 */
export function AccountControls() {
  const clerk = useClerk();
  const [confirming, setConfirming] = useState(false);
  const here = useRef<HTMLDivElement>(null);

  // Where Clerk draws. On a phone or a tablet these controls stand in the
  // conversations sheet, a modal dialog the browser keeps above everything
  // else and makes everything else inert, so Clerk's screens and its menu are
  // drawn inside that dialog. Anywhere else, null leaves them on the page.
  const within = () => here.current?.closest("dialog") ?? null;

  // Without Clerk's own link across to signing in, which would sign a Guest
  // in without being asked. Somebody with an Account signs in from here.
  const signUp = () =>
    clerk.openSignUp({
      getContainer: within,
      appearance: { elements: { footerAction__signIn: { display: "none" } } },
    });
  const signIn = () => clerk.openSignIn({ getContainer: within });

  return (
    <div ref={here} className="contents">
      <Show when="signed-out">
        {confirming ? (
          <LeavingBehind
            onSignUp={() => {
              setConfirming(false);
              signUp();
            }}
            onSignIn={() => {
              setConfirming(false);
              signIn();
            }}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-control border border-line-strong bg-surface px-3 py-1 text-meta font-medium text-ink shadow-raised pressable hover:bg-canvas"
              onClick={signUp}
            >
              Sign up
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-control px-1 py-1 text-meta text-ink-muted pressable hover:text-ink"
              // Asked when they press it rather than when it is drawn: the
              // token that says they have written something arrives in a
              // response, not through React.
              onClick={() => (guestHasWritten() ? setConfirming(true) : signIn())}
            >
              <LogIn {...smallIcon} aria-hidden="true" />
              Sign in
            </button>
          </div>
        )}
      </Show>
      <Show when="signed-in">
        {/* The menu, and the account screen it opens, drawn where the button is. */}
        <UNSAFE_PortalProvider getContainer={within}>
          <UserButton showName />
        </UNSAFE_PortalProvider>
      </Show>
    </div>
  );
}

/**
 * What signing in would leave behind, said before Clerk's screen opens, with
 * named controls — the same two-step "Delete everything" is asked with.
 */
function LeavingBehind({
  onSignUp,
  onSignIn,
  onCancel,
}: {
  onSignUp: () => void;
  onSignIn: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-2"
      onKeyDown={(pressed) => {
        // Escape puts the question away, as it would any other disclosure.
        // Inside the conversations sheet on a phone the dialog takes the second press.
        if (pressed.key === "Escape") {
          pressed.stopPropagation();
          onCancel();
        }
      }}
    >
      <p className="text-meta text-ink">
        Signing in to an account you already have leaves this visit behind: its
        conversations, trips, profile and advisor instructions are deleted. Signing up
        instead keeps all of it.
      </p>
      <div className="flex flex-wrap items-center gap-1 text-meta">
        <button
          type="button"
          className="rounded-control px-2 py-1 font-medium text-ink underline decoration-1 underline-offset-2"
          onClick={onSignUp}
        >
          Sign up instead
        </button>
        <button
          type="button"
          className="rounded-control px-2 py-1 text-error underline decoration-1 underline-offset-2"
          onClick={onSignIn}
        >
          Sign in anyway
        </button>
        <button
          type="button"
          className="rounded-control px-2 py-1 text-ink-muted underline decoration-1 underline-offset-2"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
