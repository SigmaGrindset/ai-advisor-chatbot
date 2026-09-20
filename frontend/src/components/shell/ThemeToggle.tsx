import { Moon, Sun } from "lucide-react";

import { smallIcon } from "../../design/icons";
import { useTheme } from "../../design/theme";

/**
 * The other theme, one press away.
 *
 * One control and two states, because there are two themes. The third thing
 * a theme control usually offers — "follow this machine" — is not on the
 * screen, because it is not a thing the traveler has to choose: it is what
 * they already have until they press this, and nothing here takes it away
 * from somebody who never does (`design/theme.ts`).
 *
 * The label is where the press leads rather than where it is now. A button in
 * a column of buttons is read as a thing to do, so "Dark mode" beside a moon
 * is read as the offer it is; the same words as a status line would be a
 * sentence about the screen the traveler is already looking at.
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
