import { useLayoutEffect, type RefObject } from "react";
import { ArrowUp, Square } from "lucide-react";

import { icon } from "../../design/icons";

/**
 * Where the traveler says something to the advisor.
 *
 * It holds nothing: the draft belongs to whoever owns the Conversation, so
 * unsent words survive whatever the transcript is doing. Its job is the shape
 * of the control and the ways in and out of it.
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
   * How to stop the reply, null when there is none here to stop. Not the same
   * question as `sending`: a turn in another Conversation holds this send
   * control shut, but offering to stop it here would stop the wrong one.
   */
  onStop: (() => void) | null;
}) {
  useLayoutEffect(() => {
    // Shrunk to nothing first, because `scrollHeight` of a field already tall
    // enough only ever grows. The cap is in CSS, below.
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
        // A share of the shell rather than of the window: `dvh` does not
        // shrink for a keyboard, so a field capped in it could grow to 40% of
        // a screen only half shown, leaving the transcript nothing.
        className="max-h-[calc(var(--spacing-viewport)*0.4)] resize-none rounded-panel bg-surface px-4 pt-3 pb-2 text-input text-ink outline-none placeholder:text-ink-subtle"
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
        {/* A keyboard hint, shown where there is a keyboard to hint at. On a
            phone it is two lines of advice about keys the traveler has not
            got, taken out of a screen that has none to spare. */}
        <p className="hidden font-mono text-micro text-ink-subtle sheet:block">
          Enter to send · Shift + Enter for a new line
        </p>
        {/* One control in one corner, which changes what it does rather than
            giving way to a second one: React keeps the element, so a traveler
            who reached it by keyboard still has it under them afterwards. */}
        <button
          type={onStop === null ? "submit" : "button"}
          aria-label={onStop === null ? "Send" : "Stop the reply"}
          className={`flex shrink-0 items-center justify-center rounded-chip p-2 pressable ${
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
