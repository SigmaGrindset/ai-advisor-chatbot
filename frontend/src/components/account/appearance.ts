import type { ClerkProviderProps } from "@clerk/react/types";

/** The application's one focus treatment, in place of Clerk's ring. */
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * Anything typed into, as every field the application draws is. 16px, the
 * size below which a phone zooms the page in on a focused field, and without
 * Clerk's height cap, which would clip a line that tall.
 */
const FIELD =
  "max-h-none rounded-control border border-line-strong bg-surface text-input text-ink shadow-none placeholder:text-ink-subtle focus:outline-2 focus:outline-offset-1 focus:outline-focus aria-[invalid=true]:border-error";

/** A link, as a reply draws one. */
const LINK = "font-medium text-accent underline decoration-1 underline-offset-2 hover:text-accent-strong";

/** A button that is not the one to press, as "Sign up" in the rail is drawn. */
const QUIET = "border border-line-strong bg-surface text-ink hover:bg-canvas";

/**
 * Signing in and up on a phone, which come up from the foot of the screen as
 * the application's own sheets do: full width, rounded only where they meet
 * the page, scrolling inside themselves rather than running off the top, and
 * clear of the home indicator. Given to those two alone, because `cardBox`
 * is also the frame of the account menu, which stays a menu.
 */
const SHEET = {
  modalContent: "max-sheet:mt-auto max-sheet:mb-0 max-sheet:w-full max-sheet:animate-sheet",
  cardBox:
    "max-sheet:max-h-[calc(var(--spacing-viewport)_-_2.5rem)] max-sheet:w-full max-sheet:max-w-none max-sheet:overflow-y-auto max-sheet:overscroll-contain max-sheet:rounded-b-none max-sheet:border-x-0 max-sheet:border-b-0 max-sheet:pb-safe-bottom",
};

/**
 * Clerk's screens, drawn in this application's own materials.
 *
 * Signing up and in, the codes and password resets on the way, and the menu
 * behind the account button are all drawn by Clerk. Everything here styles
 * them from `design/tokens.css`, as every other screen is, so none of them
 * reads as a form borrowed from another product.
 *
 * Two ways in, and both are needed:
 * - `variables` are what Clerk derives its own colours and sizes from. Each is
 *   a token's custom property rather than its value, so Clerk's stylesheet
 *   reads the token as it stands: switching theme restyles an open modal in
 *   the same frame as the page behind it, and nothing here knows that there
 *   are two themes.
 * - `elements` hand the application's own classes to what a variable does not
 *   reach: Clerk's shadows, the sheen on its buttons, its focus ring. They win
 *   because Clerk's stylesheet sits in a cascade layer below the utilities
 *   (`design/base.css`), whatever its selectors are.
 */
export const appearance = {
  cssLayerName: "clerk",

  options: {
    // Clerk marks every screen of a development instance as one. This
    // instance is a development one by decision, not a stage on the way to
    // production, and the marking is in Clerk's own orange.
    unsafe_disableDevelopmentModeWarnings: true,
    // The application has no logo to show, and the dashboard's is Clerk's.
    logoPlacement: "none",
    // A white gleam across the avatar, which no other surface here has.
    shimmer: false,
  },

  variables: {
    colorPrimary: "var(--color-accent)",
    colorPrimaryForeground: "var(--color-accent-contrast)",
    colorDanger: "var(--color-error)",
    // Clerk's success is a code or password that checks out, which is what
    // the verified colour already means. Its warnings are the rarer ask for
    // attention, and take the contour brown of a field just changed.
    colorSuccess: "var(--color-verified)",
    colorWarning: "var(--color-changed)",
    // What Clerk mixes its hairlines and hovers from, at low strength: the
    // ink, so they run green of grey like every other hairline here.
    colorNeutral: "var(--color-ink)",
    colorForeground: "var(--color-ink)",
    colorMutedForeground: "var(--color-ink-subtle)",
    colorMuted: "var(--color-canvas)",
    colorBackground: "var(--color-surface)",
    colorInput: "var(--color-surface)",
    colorInputForeground: "var(--color-ink)",
    colorRing: "var(--color-focus)",
    colorShadow: "var(--color-shade)",
    fontFamily: "var(--font-sans)",
    fontFamilyButtons: "var(--font-sans)",
    fontFamilyMono: "var(--font-mono)",
    fontSize: "var(--text-meta)",
    borderRadius: "var(--radius-control)",
  },

  elements: {
    // ---- The modal ------------------------------------------------------
    // As tall as whatever it is drawn in. Over the page that is the window;
    // inside a sheet it is the sheet's dialog, which is already the height of
    // what the browser is showing, keyboard or not.
    modalBackdrop: "h-full bg-scrim",
    modalContent: "animate-panel",
    modalCloseButton: "rounded-control text-ink-subtle hover:bg-canvas hover:text-ink",
    // One panel with hairlines inside it, rather than Clerk's card stacked on
    // a shaded footer. `cardBox` is also the frame of the account menu.
    cardBox: "rounded-panel border border-line bg-surface shadow-floating",
    card: "m-0 rounded-none border-0 bg-transparent shadow-none",
    footer: "mt-0 border-t border-line bg-transparent pt-0",
    footerItem: "border-line",
    footerActionText: "text-ink-muted",
    footerActionLink: LINK,
    footerPagesLink: LINK,

    headerTitle: "font-display text-title font-semibold text-ink",
    headerSubtitle: "text-meta text-ink-muted",
    headerBackLink: LINK,
    backLink: LINK,
    identityPreview: "border-line",
    identityPreviewText: "text-ink",
    identityPreviewEditButton: "text-accent hover:text-accent-strong",
    dividerLine: "bg-line",
    dividerText: "text-meta text-ink-subtle",

    // ---- Buttons --------------------------------------------------------
    // Clerk's shadow, its sheen and its focus ring, gone from every button.
    button: `shadow-none after:hidden ${FOCUS}`,
    formButtonPrimary: "bg-accent text-accent-contrast pressable-row hover:bg-accent-strong disabled:opacity-40",
    socialButtonsBlockButton: `${QUIET} pressable-row`,
    socialButtonsBlockButtonText: "font-medium text-ink",
    socialButtonsIconButton: `${QUIET} pressable`,
    alternativeMethodsBlockButton: `${QUIET} pressable-row`,
    lastAuthenticationStrategyBadge:
      "rounded-chip border border-line bg-canvas font-mono text-micro text-ink-muted uppercase shadow-none",

    // ---- Fields ---------------------------------------------------------
    formFieldLabel: "text-meta font-medium text-ink",
    formFieldInput: FIELD,
    formFieldAction: LINK,
    // Inside its field, at a size a thumb-sized button would overflow.
    formFieldInputShowPasswordButton:
      "text-ink-subtle hover:bg-canvas hover:text-ink pointer-coarse:min-h-0",
    formFieldErrorText: "text-meta text-error",
    formFieldWarningText: "text-meta text-changed",
    formFieldSuccessText: "text-meta text-verified",
    formFieldInfoText: "text-meta text-ink-subtle",
    formFieldHintText: "text-meta text-ink-subtle",

    // The code's boxes are drawn over one real field, which Clerk sizes to
    // the row and so is never small enough to zoom into. A box is focused
    // when it is the one the next digit lands in.
    otpCodeFieldInput:
      "rounded-control border border-line-strong bg-surface font-mono text-ink shadow-none aria-[invalid=true]:border-error data-[focus-within=true]:outline-2 data-[focus-within=true]:outline-offset-1 data-[focus-within=true]:outline-focus",
    otpCodeFieldErrorText: "text-meta text-error",
    otpCodeFieldSuccessText: "text-meta text-verified",
    formResendCodeLink: LINK,

    // A failure that belongs to the whole form, as a failed turn is drawn.
    alert: "rounded-panel border-0 shadow-none",
    alert__danger: "bg-error-tint",
    alertText__danger: "text-meta text-error",
    alertIcon__danger: "text-error",

    // ---- The account menu -----------------------------------------------
    userButtonTrigger: "rounded-control",
    userButtonOuterIdentifier: "text-meta font-medium text-ink",
    userButtonPopoverMain: "m-0 rounded-none border-0 bg-transparent shadow-none",
    userButtonPopoverActions: "border-line",
    userButtonPopoverActionButton: "text-ink hover:bg-sunken",
    userButtonPopoverActionButtonIcon: "text-ink-subtle",
    userButtonPopoverFooter: "mt-0 border-t border-line bg-transparent pt-0",
    userPreviewSecondaryIdentifier: "text-ink-subtle",
  },

  signIn: { elements: SHEET },
  signUp: { elements: SHEET },
} satisfies ClerkProviderProps["appearance"];
