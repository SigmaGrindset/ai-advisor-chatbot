import { useLayoutEffect, type RefObject } from "react";
import { ArrowUp, Square } from "lucide-react";

import { icon } from "./design/icons";

/**
 * Where the traveler says something to the advisor.
 *
 * It holds nothing: the draft belongs to whoever owns the Conversation, so
 * that words typed and not yet sent survive whatever the transcript above is
 * doing. Its own job is the shape of the control, the two ways of committing
 * what is in it, and the one way of calling a reply off.
 */
export function Composer({
  field,
  draft,
  sending,
  onDraft,
  onSend,
  onStop,
}: {
  /** The field itself, held by the pane so a starter prompt can focus it. */
  field: RefObject<HTMLTextAreaElement | null>;
  draft: string;
  /** True while a turn is in flight, whichever Conversation it belongs to. */
  sending: boolean;
  onDraft: (draft: string) => void;
  onSend: () => void;
  /**
   * How to stop the reply, and null when there is none here to stop.
   *
   * Not the same question as `sending`: a turn in another Conversation still
   * holds this one's send control shut, but it is not this Conversation's
   * reply and offering to stop it here would stop the wrong one.
   */
  onStop: (() => void) | null;
}) {
  useLayoutEffect(() => {
    // The field is measured from its own content: shrunk to nothing first,
    // because `scrollHeight` of a field already tall enough only ever grows.
    // The height it is given is capped in CSS, which is where the field stops
    // growing and starts scrolling. The cap is `dvh` rather than `vh` because
    // a phone's virtual keyboard displaces a `vh`-sized composer (ADR-0007).
    const growing = field.current;
    if (growing === null) return;
    growing.style.height = "auto";
    growing.style.height = `${growing.scrollHeight}px`;
  }, [draft]);

  return (
    <form
      className="mx-auto flex max-w-reading flex-col rounded-panel border border-line-strong bg-surface shadow-raised transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
      onSubmit={(submitted) => {
        submitted.preventDefault();
        onSend();
      }}
    >
      <textarea
        ref={field}
        className="max-h-[40dvh] resize-none rounded-panel bg-surface px-4 pt-3 pb-2 text-input text-ink outline-none placeholder:text-ink-subtle"
        rows={1}
        value={draft}
        placeholder="Where are you going?"
        aria-label="Message the advisor"
        onChange={(typed) => onDraft(typed.target.value)}
        onKeyDown={(pressed) => {
          if (pressed.key === "Enter" && !pressed.shiftKey) {
            pressed.preventDefault();
            onSend();
          }
        }}
      />

      <div className="flex items-center justify-between gap-3 px-3 pb-3">
        <p className="font-mono text-micro text-ink-subtle">
          Enter to send · Shift + Enter for a new line
        </p>
        {/* One control in one corner, which changes what it does rather than
            giving way to a second one: React keeps the element, so a traveler
            who reached it by keyboard still has it under them afterwards. */}
        <button
          type={onStop === null ? "submit" : "button"}
          aria-label={onStop === null ? "Send" : "Stop the reply"}
          className={`flex shrink-0 items-center justify-center rounded-chip p-2 transition-colors ${
            onStop === null
              ? "bg-accent text-accent-contrast hover:bg-accent-strong disabled:opacity-40"
              : "border border-line-strong bg-surface text-ink hover:bg-sunken"
          }`}
          disabled={onStop === null && (draft.trim() === "" || sending)}
          onClick={onStop ?? undefined}
        >
          {onStop === null ? (
            <ArrowUp {...icon} aria-hidden="true" />
          ) : (
            <Square {...icon} aria-hidden="true" />
          )}
        </button>
      </div>
    </form>
  );
}
