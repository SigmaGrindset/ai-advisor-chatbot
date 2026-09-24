import { ClerkFailed, ClerkLoaded, ClerkProvider, useAuth } from "@clerk/react";
import { StrictMode, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";

import { askClerkWith } from "./api/client";
import { App } from "./App";
import "./design/base.css";

/**
 * Clerk's publishable key, fixed at build time. Without one there are no
 * Accounts: nobody can sign in, and everyone is a Guest.
 */
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";

/**
 * The application as whoever is signed in, drawn afresh when that changes.
 * Signing out leaves a screen that knows nothing of them, and signing in
 * reads everything again as the Account.
 */
function AsWhoeverIsSignedIn() {
  const { userId, getToken } = useAuth();
  // A layout effect, so the requests `App` makes as its ordinary effects run
  // already carry the token.
  useLayoutEffect(() => askClerkWith(getToken), [getToken]);
  return <App key={userId ?? "guest"} accounts={userId ? "signed-in" : "guest"} />;
}

const container = document.getElementById("root");
if (!container) throw new Error("No #root element to mount into");

createRoot(container).render(
  <StrictMode>
    {CLERK_PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        {/* Nothing is drawn until Clerk has said who is signed in, so nothing
            is read, or written, as anyone else. */}
        <ClerkLoaded>
          <AsWhoeverIsSignedIn />
        </ClerkLoaded>
        {/* Clerk could not load, so nobody can be signed in on this page. */}
        <ClerkFailed>
          <App accounts="unavailable" />
        </ClerkFailed>
      </ClerkProvider>
    ) : (
      <App accounts="unavailable" />
    )}
  </StrictMode>,
);
