import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";
import { LogIn } from "lucide-react";

import { smallIcon } from "../../design/icons";

/**
 * Signing up and signing in, and once signed in, Clerk's own button for the
 * Account in their place.
 *
 * Both open Clerk's screens over the Conversation rather than going to a page
 * of their own, so nothing half-written is lost on the way there and back.
 * Neither shows until Clerk has said whether anyone is signed in.
 */
export function AccountControls() {
  return (
    <>
      <Show when="signed-out">
        <div className="flex items-center gap-2">
          <SignUpButton mode="modal">
            <button
              type="button"
              className="rounded-control border border-line-strong bg-surface px-3 py-1 text-meta font-medium text-ink shadow-raised pressable hover:bg-canvas"
            >
              Sign up
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button
              type="button"
              className="flex items-center gap-2 rounded-control px-1 py-1 text-meta text-ink-muted pressable hover:text-ink"
            >
              <LogIn {...smallIcon} aria-hidden="true" />
              Sign in
            </button>
          </SignInButton>
        </div>
      </Show>
      <Show when="signed-in">
        <UserButton showName />
      </Show>
    </>
  );
}
