/**
 * Which of the two themes the application is drawn in.
 *
 * It follows the machine until the traveler says otherwise, and then follows
 * them at noon and at midnight — they were looking at the machine's answer
 * when they disagreed with it.
 *
 * Kept outside React because three unrelated places read it: the switch, the
 * chip colours mixed in `tripPastel.ts`, and `<html>` itself. Everything else
 * about the theme is one attribute on the root and `design/tokens.css`.
 */

import { useSyncExternalStore } from "react";

export type Scheme = "light" | "dark";

/** `system` is not a third theme — it is the absence of an answer. */
export type ThemePreference = "system" | Scheme;

/**
 * Both are named again in the snippet at the top of `index.html`, which runs
 * before this module exists (see `applied`). `theme.test.ts` reads the markup
 * and checks the two have not drifted.
 */
export const THEME_KEY = "travel-advisor.theme";
export const THEME_ATTRIBUTE = "data-theme";

const DARK = "(prefers-color-scheme: dark)";

export type Theme = {
  scheme: Scheme;
  /** Draw it in the other one, and remember having been asked to. */
  toggle: () => void;
};

/**
 * Anything that is not one of the two themes means follow the machine: an
 * unrecognised value came from a version of this application that no longer
 * exists, so the traveler has told *this* one nothing.
 */
export function preferenceFrom(stored: string | null): ThemePreference {
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** What a preference works out to, given what the machine is set to. */
export function schemeFor(preference: ThemePreference, machineIsDark: boolean): Scheme {
  if (preference === "system") return machineIsDark ? "dark" : "light";
  return preference;
}

export function useTheme(): Theme {
  return { scheme: useSyncExternalStore(subscribe, here, light), toggle };
}

/** What the traveler asked for, as far as this tab knows. */
let asked = preferenceFrom(read());

/**
 * Worked out on the first ask rather than on import, so importing this module
 * where there is no window — a test of the two functions above — still works.
 */
let current: Scheme | null = null;

const watching = new Set<() => void>();

function here(): Scheme {
  current ??= schemeFor(asked, machineIsDark());
  return current;
}

/** What `useSyncExternalStore` is told where there is no window to ask. */
function light(): Scheme {
  return "light";
}

function subscribe(changed: () => void): () => void {
  // The attribute is already right, but the colour around the page is not:
  // `index.html` ships the light canvas, because a colour cannot be read off
  // a stylesheet that has not loaded yet.
  if (watching.size === 0) applied(here());
  watching.add(changed);
  // The machine's own setting, which moves under a traveler who has not
  // disagreed with it.
  const machine = window.matchMedia(DARK);
  machine.addEventListener("change", settle);
  // The same application in another tab. `storage` fires in the tabs that did
  // *not* make the change, which is exactly the set that needs telling.
  window.addEventListener("storage", stored);
  return () => {
    watching.delete(changed);
    machine.removeEventListener("change", settle);
    window.removeEventListener("storage", stored);
  };
}

function stored(event: StorageEvent) {
  // `key` is null when a tab cleared all of storage: the preference went too.
  if (event.key !== null && event.key !== THEME_KEY) return;
  asked = preferenceFrom(read());
  settle();
}

/**
 * The other theme, from now on. Stored as a theme rather than as "disagree
 * with the machine": they are looking at one of the two and want the other.
 */
function toggle() {
  asked = here() === "dark" ? "light" : "dark";
  write(asked);
  settle();
}

/**
 * Settle the scheme, put it on the page and tell whoever is watching — but
 * only on a change: a machine turning dark under a traveler who asked for
 * light has changed nothing here.
 */
function settle() {
  const settled = schemeFor(asked, machineIsDark());
  if (settled === here()) return;
  current = settled;
  applied(settled);
  for (const changed of watching) changed();
}

/**
 * The scheme, on the page. Set here *and* by a snippet in `index.html`:
 * applied only from React it would flash white first, and a snippet alone
 * could not hear the traveler switch again.
 *
 * `theme-color` is the browser's furniture around the page. It is read back
 * off the stylesheet, so the one place a colour is named stays `tokens.css`.
 */
function applied(scheme: Scheme) {
  const root = document.documentElement;
  root.setAttribute(THEME_ATTRIBUTE, scheme);
  const canvas = getComputedStyle(root).getPropertyValue("--color-canvas").trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (canvas !== "" && meta !== null) meta.setAttribute("content", canvas);
}

function machineIsDark(): boolean {
  return window.matchMedia(DARK).matches;
}

/**
 * Storage, which is allowed to refuse: a browser keeping no site data throws
 * on reaching for `localStorage` at all. A traveler whose choice cannot be
 * remembered still keeps it for as long as the tab is open.
 */
function read(): string | null {
  try {
    return window.localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function write(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Nothing to do and nothing to say: see above.
  }
}
