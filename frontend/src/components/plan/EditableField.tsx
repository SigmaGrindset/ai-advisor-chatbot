import { useEffect, useRef, useState } from "react";

/**
 * One part of the Trip Plan the traveler can change themselves.
 *
 * It carries a dotted underline at every width and under every pointer,
 * always. Which parts of a plan are the traveler's to change is not something
 * a touch screen can be asked to discover by hovering, and an interface that
 * only admits to being editable under a mouse has told half its travelers
 * nothing (ADR-0007).
 *
 * Clicking it edits in place. Blur saves, Escape cancels, Enter saves — and
 * Escape is stopped here rather than left to bubble, because on a phone this
 * field is inside a sheet whose own Escape closes it, and one press should be
 * one thing.
 *
 * The draft lives here, which is what makes a traveler's typing survive the
 * advisor patching the same field mid-sentence: what arrives goes into the
 * plan behind this field, never into the field. What the advisor wanted is
 * offered underneath as a suggestion instead — `merging.ts` decides that, and
 * this draws it.
 */
export function EditableField({
  field,
  label,
  value,
  shown,
  placeholder,
  kind = "text",
  align = "right",
  size = "body",
  lit = false,
  suggestion = null,
  onEditing,
  onSave,
  onDismiss,
}: {
  /** What this field is called, the way the plan and the server both name it. */
  field: string;
  /** For anyone who cannot see which row this sits on. */
  label: string;
  /** What the editor opens with, and what a save is measured against. */
  value: string;
  /** How it reads when it is not being edited. Empty for a field holding nothing. */
  shown: string;
  /** What to say instead when it holds nothing — an invitation, not a dash. */
  placeholder: string;
  kind?: "text" | "date" | "number";
  /**
   * Which edge the value sits against. The facts at the top of the plan are
   * a column of values read down the right; a line of the itinerary is a
   * sentence, and a sentence that wraps reads from the left.
   */
  align?: "left" | "right";
  /**
   * How large it is set. Every field of the plan is a line of a record and
   * reads at `body` — except the destination, which is the name of the whole
   * journey and is the head of its own record rather than a line of it.
   *
   * The editor is set at the same size as the reading state, so a field the
   * traveler clicks into does not resize under the click.
   */
  size?: "body" | "display";
  /** True while the advisor's last change to this field is still lit. */
  lit?: boolean;
  /** What the advisor wanted for this field while the traveler was in it. */
  suggestion?: string | null;
  onEditing: (field: string | null) => void;
  onSave: (value: string) => void;
  onDismiss: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // Whether an editor is open, kept where a blur arriving after the editor
  // has gone can still read it. State cannot answer that: the handler closed
  // over the render before the one that put the editor away.
  const open = useRef(false);
  const editing = draft !== null;
  // The face and the size, chosen once and spent on both states, so that the
  // reading state and the editor are the same words in the same type.
  const set =
    size === "display" ? "font-display text-display font-semibold" : "text-body";

  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    // Selected rather than placed at the end: the commonest edit of a field
    // that already says something is replacing it.
    input.current?.select();
  }, [editing]);

  function start() {
    open.current = true;
    setDraft(value);
    onEditing(field);
  }

  function stop(saving: boolean) {
    if (!open.current) return;
    open.current = false;
    const typed = (draft ?? "").trim();
    setDraft(null);
    onEditing(null);
    if (saving && typed !== value) onSave(typed);
  }

  return (
    <div
      className={`flex min-w-0 flex-col gap-1 ${
        align === "right" ? "items-end" : "w-full items-start"
      }`}
    >
      {!editing ? (
        <button
          type="button"
          aria-label={`${label}: ${shown === "" ? placeholder : shown}. Click to edit.`}
          onClick={start}
          className={`max-w-full rounded-control border-b border-dotted border-line-strong px-1 transition-colors duration-500 hover:bg-sunken active:translate-y-px ${set} ${
            align === "right" ? "text-right" : "text-left"
          } ${lit ? "bg-changed-tint" : ""} ${
            shown === "" ? "text-ink-subtle italic" : "text-ink"
          }`}
        >
          {shown === "" ? placeholder : shown}
        </button>
      ) : (
        <input
          ref={input}
          type={kind}
          inputMode={kind === "number" ? "numeric" : undefined}
          aria-label={label}
          value={draft}
          onChange={(typed) => setDraft(typed.target.value)}
          onBlur={() => stop(true)}
          onKeyDown={(pressed) => {
            if (pressed.key === "Enter") stop(true);
            else if (pressed.key === "Escape") {
              // Not the sheet's Escape, and not the dialog's close request.
              pressed.preventDefault();
              pressed.stopPropagation();
              stop(false);
            } else return;
          }}
          className={`w-full min-w-0 rounded-control border border-line-strong bg-surface px-1.5 py-0.5 text-ink outline-none focus:outline-2 focus:outline-offset-1 focus:outline-focus ${
            size === "display" ? set : "text-input"
          } ${align === "right" ? "text-right" : "text-left"}`}
        />
      )}

      {suggestion !== null && (
        <Suggested
          align={align}
          label={label}
          value={suggestion}
          onTake={() => {
            // The editor, if it is still open, is abandoned rather than
            // saved: taking the advisor's value and saving the traveler's
            // half-typed one in the same breath would race, and the traveler
            // has just said which of the two they want.
            stop(false);
            onSave(suggestion);
            onDismiss();
          }}
          onLeave={onDismiss}
        />
      )}
    </div>
  );
}

/**
 * What the advisor wanted for a field the traveler had open.
 *
 * Quiet on purpose: it is a note under the field, not a dialog and not an
 * alert. Nothing was overwritten and nothing is waiting on an answer — the
 * traveler's own value is what the plan says, and this is only here in case
 * they would rather have the other one.
 */
function Suggested({
  align,
  label,
  value,
  onTake,
  onLeave,
}: {
  align: "left" | "right";
  label: string;
  value: string;
  onTake: () => void;
  onLeave: () => void;
}) {
  return (
    <p
      className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 text-micro text-ink-subtle ${
        align === "right" ? "justify-end text-right" : "justify-start text-left"
      }`}
    >
      <span>
        The advisor suggested <span className="font-mono text-ink-muted">{value}</span>
      </span>
      <span className="flex gap-2">
        {/* Pressing either of these must not take the focus out of the
            field above and commit what is half-typed in it. Preventing the
            default of the press is what keeps the field focused; the click
            still arrives. */}
        <button
          type="button"
          className="rounded-control px-1 font-medium text-accent underline underline-offset-2 hover:text-accent-strong"
          onMouseDown={(pressed) => pressed.preventDefault()}
          onClick={onTake}
        >
          Use it
        </button>
        <button
          type="button"
          aria-label={`Keep my ${label.toLowerCase()}`}
          className="rounded-control px-1 hover:text-ink"
          onMouseDown={(pressed) => pressed.preventDefault()}
          onClick={onLeave}
        >
          Keep mine
        </button>
      </span>
    </p>
  );
}
