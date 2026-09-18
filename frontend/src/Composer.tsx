import { ArrowUp } from "lucide-react";

import { icon } from "./design/icons";

/**
 * Where the traveler says something to the advisor.
 *
 * It holds nothing: the draft belongs to whoever owns the Conversation, so
 * that words typed and not yet sent survive whatever the transcript above is
 * doing. Its own job is the shape of the control and the two ways of
 * committing what is in it.
 */
export function Composer({
  draft,
  sending,
  onDraft,
  onSend,
}: {
  draft: string;
  /** True while a turn is in flight, whichever Conversation it belongs to. */
  sending: boolean;
  onDraft: (draft: string) => void;
  onSend: () => void;
}) {
  return (
    <form
      className="mx-auto flex max-w-reading flex-col rounded-panel border border-line-strong bg-surface shadow-raised transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
      onSubmit={(submitted) => {
        submitted.preventDefault();
        onSend();
      }}
    >
      <textarea
        className="resize-none rounded-panel bg-surface px-4 pt-3 pb-2 text-input text-ink outline-none placeholder:text-ink-subtle"
        rows={2}
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
        <button
          type="submit"
          aria-label="Send"
          className="flex shrink-0 items-center justify-center rounded-chip bg-accent p-2 text-accent-contrast transition-colors hover:bg-accent-strong disabled:opacity-40"
          disabled={draft.trim() === "" || sending}
        >
          <ArrowUp {...icon} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
