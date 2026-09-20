/**
 * Which of the two themes the application is drawn in.
 *
 * It ships following the machine, and stops the moment the traveler says
 * otherwise. That is the whole rule: somebody who has never touched the
 * switch gets what the rest of their screen is set to, because an application
 * that overrides a machine-wide preference nobody has contradicted has
 * decided it knows better — and somebody who has touched it gets what they
 * asked for, at noon and at midnight, because they were looking at the
 * machine's answer when they disagreed with it.
 *
 * Kept here rather than in React state because three unrelated places read
 * it — the switch that sets it, the chips whose colours are mixed in
 * TypeScript (`tripPastel.ts`), and `<html>` itself — and a copy per reader
 * is three answers to a question with one. `useSyncExternalStore` is the same
 * shape `shell/layout.ts` uses for the window's width, for the same reason:
 * the source of truth is the browser, not a component.
 *
 * Everything else about the theme is CSS. The tokens are named for their
 * roles, so this module's entire effect on how the application looks is one
 * attribute on the root element; `design/tokens.css` does the rest.
 */

import { useSyncExternalStore } from "react";

/** The two themes that exist. */
export type Scheme = "light" | "dark";

/**
 * What the traveler asked for. `system` is not a third theme — it is the
 * absence of an answer, which is what everybody starts with.
 */
export type ThemePreference = "system" | Scheme;

/**
 * Where the preference is kept, and the attribute it is spent on.
 *
 * Both are named again in the snippet at the top of `index.html`, which runs
 * before this module exists — see `applied` below for why that snippet has to
 * be there at all. Two places naming one string is a thing that can drift, so
 * `theme.test.ts` reads the markup and checks that it has not.
 */
export const THEME_KEY = "travel-advisor.theme";
export const THEME_ATTRIBUTE = "data-theme";

/** The query that answers what the machine itself is set to. */
const DARK = "(prefers-color-scheme: dark)";

export type Theme = {
  /** What the application is drawn in right now. */
  scheme: Scheme;
  /** Draw it in the other one, and remember having been asked to. */
  toggle: () => void;
};

/**
 * What a stored value means.
 *
 * Anything that is not one of the two themes means follow the machine, which
 * is also what no stored value at all means: the entry is written by this
 * application and read by this application, so a value it does not recognise
 * is a value from a version of it that no longer exists, and the honest
 * reading of that is that the traveler has not told *this* version anything.
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
 * The theme showing, worked out on the first ask rather than on import, so
 * that importing this module somewhere there is no window — a test of the two
 * functions above — is not the same as running it.
 */
let current: Scheme | null = null;

const watching = new Set<() => void>();

function here(): Scheme {
  current ??= schemeFor(asked, machineIsDark());
  return current;
}

/**
 * What this is before a browser has said otherwise. Nothing renders this
 * application on a server, but `useSyncExternalStore` asks, and the honest
 * answer to "what theme is it where there are no windows" is the one it
 * started as.
 */
function light(): Scheme {
  return "light";
}

function subscribe(changed: () => void): () => void {
  // The first component to watch the theme is also the first moment the theme
  // can be put on the page properly. The attribute is already right — the
  // snippet in the head of `index.html` settled it before the first paint —
  // but the colour around the page is not: that markup ships the light canvas,
  // because a colour cannot be read off a stylesheet that has not loaded yet.
  if (watching.size === 0) applied(here());
  watching.add(changed);
  // The machine's own setting, which moves under a traveler who has not
  // disagreed with it — at dusk on a phone that turns over on a schedule, or
  // the moment they flip the switch in their settings with this tab open.
  const machine = window.matchMedia(DARK);
  machine.addEventListener("change", settle);
  // The same application in another tab. Without this, switching to dark in
  // one window leaves every other window it is open in on the old theme until
  // each is reloaded — and `storage` is the one event that fires in the tabs
  // that did *not* make the change, which is exactly the set that needs it.
  window.addEventListener("storage", stored);
  return () => {
    watching.delete(changed);
    machine.removeEventListener("change", settle);
    window.removeEventListener("storage", stored);
  };
}

function stored(event: StorageEvent) {
  // `key` is null when a tab cleared the whole of storage, which is also
  // news: the preference went with it.
  if (event.key !== null && event.key !== THEME_KEY) return;
  asked = preferenceFrom(read());
  settle();
}

/**
 * The other theme, from now on.
 *
 * Asked for as a theme rather than as "the opposite of whatever the machine
 * says", because the traveler is looking at one of the two when they press
 * this and the other one is what they want — not a standing instruction to
 * disagree with a machine whose own setting they cannot see from here.
 */
function toggle() {
  asked = here() === "dark" ? "light" : "dark";
  write(asked);
  settle();
}

/**
 * Work out what the application is drawn in now, put it on the page, and tell
 * whoever is watching — but only if it is not what it already was. A machine
 * that turns dark under a traveler who asked for light has changed nothing
 * about this application, and a re-render that redraws the same colours is a
 * re-render nobody asked for.
 */
function settle() {
  const settled = schemeFor(asked, machineIsDark());
  if (settled === here()) return;
  current = settled;
  applied(settled);
  for (const changed of watching) changed();
}

/**
 * The scheme, on the page.
 *
 * The attribute is what every colour hangs off, and it is set here *and* by a
 * snippet in `index.html` that runs before the stylesheet paints. Both,
 * because neither is enough on its own: a traveler who chose dark and whose
 * theme were applied only from React would watch the application load in
 * white and then turn over, which is a flash of exactly the thing they said
 * they did not want — and a snippet alone could not hear them switch again.
 *
 * `theme-color` is the browser's own furniture around the page: the status
 * bar on an installed phone application, the strip above the address bar. It
 * is read back off the stylesheet rather than written here, so the one place
 * a colour is named stays `tokens.css`.
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
 * Storage, which is allowed to refuse.
 *
 * A browser told to keep no site data throws on the mere act of reaching for
 * `localStorage`, and it throws again on writing when a quota is full. None
 * of that is worth a broken application over: a traveler whose choice cannot
 * be remembered still gets the theme they chose for as long as the tab is
 * open, and gets their machine's back on the next visit.
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
