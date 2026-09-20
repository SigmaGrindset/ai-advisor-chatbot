import { Moon, Sun } from "lucide-react";

import { smallIcon } from "../../design/icons";
import { useTheme } from "../../design/theme";

/**
 * The other theme, one press away.
 *
 * One control and two states. The third thing a theme control usually offers
 * — "follow this machine" — is not on screen because it is not a choice: it
 * is what they have until they press this (`design/theme.ts`).
 *
 * The label is where the press leads rather than where it is now, because a
 * button in a column of buttons reads as a thing to do.
 */
export function ThemeToggle() {
  const { scheme, toggle } = useTheme();
  const dark = scheme === "dark";
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-control px-1 py-1 text-meta text-ink-muted pressable hover:text-ink"
      onClick={toggle}
    >
      {dark ? <Sun {...smallIcon} aria-hidden="true" /> : <Moon {...smallIcon} aria-hidden="true" />}
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
