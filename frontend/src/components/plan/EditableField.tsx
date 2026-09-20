import { useEffect, useRef, useState } from "react";

/**
 * One part of the Trip Plan the traveler can change themselves.
 *
 * The dotted underline is there at every width and without hovering: an
 * interface that only admits to being editable under a mouse has told half
 * its travelers nothing (ADR-0007).
 *
 * Blur saves, Enter saves, Escape cancels — stopped here rather than left to
 * bubble, because on a phone this sits in a sheet whose own Escape closes it.
 *
 * The draft lives here, which is what makes typing survive the advisor
 * patching the same field mid-sentence: what arrives goes into the plan
 * behind the field, and is offered underneath as a suggestion (`merging.ts`).
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
  /** How it reads when it is not being edited. */
  shown: string;
  /** What to say when it holds nothing — an invitation, not a dash. */
  placeholder: string;
  kind?: "text" | "date" | "number";
  /**
   * The facts at the top of the plan are a column read down the right; a line
   * of the itinerary is a sentence, and a wrapped sentence reads from the left.
   */
  align?: "left" | "right";
  /**
   * `body` for a line of a record, `display` for the destination, which heads
   * its own record. The editor is set at the same size as the reading state,
   * so a field does not resize under the click.
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
  // Kept where a blur arriving after the editor has gone can still read it:
  // that handler closed over the render before the one that closed it.
  const open = useRef(false);
  const editing = draft !== null;
  // Chosen once and spent on both states, so reading and editing are the same
  // words in the same type.
  const set =
    size === "display" ? "font-display text-display font-semibold" : "text-body";

  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    // Selected: the commonest edit of a field that says something is replacing it.
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
            // An open editor is abandoned rather than saved: the traveler has
            // just said which of the two values they want.
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
 * What the advisor wanted for a field the traveler had open. A note rather
 * than a dialog: nothing was overwritten and nothing waits on an answer — the
 * traveler's value is what the plan says.
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
        {/* Preventing the press's default keeps focus in the field above, so
            neither of these commits what is half-typed there. */}
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
