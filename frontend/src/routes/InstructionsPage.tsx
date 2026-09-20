import { useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";

import type { AdvisorInstructions } from "../api/types";
import { icon, smallIcon } from "../design/icons";
import { Skeleton } from "../components/shell/Skeleton";

/**
 * The Advisor Instructions, and the whole prompt they are composed into.
 *
 * A page rather than a pane, and one of the two there are: what the advisor is
 * told is about none of the open Conversations in particular, and a traveler
 * can be *at* it — an edit is something you come back to and a link is
 * something you send yourself (ADR-0012).
 *
 * It shows two things that have to be seen together. Above, the part the
 * traveler owns: the advisor's persona and its rules, editable. Below, the
 * whole system prompt as it is actually sent — their instructions with the
 * Traveler Profile, the Trip Plan and the tool guidance composed around them.
 * The second is not a description of the first, it is the server's own
 * composition of it, so there is nothing here that can drift from what the
 * next message sends.
 *
 * It draws what it is handed. What is saved, and when it is re-read, is
 * `App.tsx`'s, for the same reason the Trips page's list is.
 */
export function InstructionsPage({
  instructions,
  saving,
  failure,
  onSave,
  onRestore,
  onBack,
}: {
  /** What the server last said, and null while it is still being read. */
  instructions: AdvisorInstructions | null;
  saving: boolean;
  /** What went wrong, in the traveler's terms, if anything did. */
  failure: string | null;
  onSave: (revised: string) => void;
  onRestore: () => void;
  onBack: () => void;
}) {
  return (
    <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-3 sm:px-6 sm:py-4">
        <button
          type="button"
          className="flex shrink-0 items-center gap-2 rounded-control p-2 text-meta text-ink-muted pressable hover:bg-sunken hover:text-ink"
          onClick={onBack}
        >
          <ArrowLeft {...icon} aria-hidden="true" />
          Conversations
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-safe-bottom sm:px-6">
        <div className="mx-auto flex max-w-reading flex-col gap-8 py-8">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-display text-balance text-ink sm:text-page">Advisor instructions</h1>
            <p className="text-meta text-ink-subtle">
              This is what your advisor is told before it reads a word you have written.
              Change it and your very next message uses it — in this conversation and in
              every other one, including the ones you started before the edit.
            </p>
          </div>

          {failure !== null && (
            <p role="alert" className="text-meta text-error">
              {failure}
            </p>
          )}

          {instructions === null ? (
            // The shape of what is coming rather than a sentence about it: the
            // editor and the composed prompt below it are both tall, and a
            // line of text where a page is about to be is a page that jumps.
            <div
              className="flex flex-col gap-3"
              role="status"
              aria-label="Reading your advisor's instructions"
            >
              <Skeleton className="h-2.5 w-32" />
              <Skeleton className="h-56 w-full sm:h-80" />
              <Skeleton className="h-8 w-20" />
            </div>
          ) : (
            <Editing
              // Keyed on the version, so a save or a restore replaces the
              // editor rather than leaving a draft standing over instructions
              // that are no longer the ones it was started from.
              key={instructions.version_id}
              instructions={instructions}
              saving={saving}
              onSave={onSave}
              onRestore={onRestore}
            />
          )}
        </div>
      </div>
    </main>
  );
}

/** The instructions being edited, and the prompt they are part of. */
function Editing({
  instructions,
  saving,
  onSave,
  onRestore,
}: {
  instructions: AdvisorInstructions;
  saving: boolean;
  onSave: (revised: string) => void;
  onRestore: () => void;
}) {
  const [draft, setDraft] = useState(instructions.instructions);
  const edited = draft !== instructions.instructions;
  // Emptied entirely, the advisor would be left with the application's own
  // guidance and no persona at all. That is a slip rather than an instruction,
  // and the server refuses it — so the control says so before it is pressed.
  const emptied = draft.trim() === "";

  return (
    <>
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-mono text-micro uppercase text-ink-subtle">Yours to change</h2>
          <p className="text-meta text-ink-subtle">
            How the advisor talks, what it helps with, and what it leaves alone.
          </p>
        </div>

        <textarea
          value={draft}
          spellCheck={false}
          aria-label="Advisor instructions"
          className="min-h-56 w-full resize-y rounded-panel border border-line bg-surface p-3 font-mono text-input text-ink outline-none sm:min-h-80"
          onChange={(typed) => setDraft(typed.target.value)}
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            className="rounded-control bg-accent px-3 py-2 text-meta font-medium text-accent-contrast pressable hover:bg-accent-strong disabled:opacity-40"
            disabled={!edited || emptied || saving}
            onClick={() => onSave(draft)}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {/* Said rather than drawn, and announced: whether what is on screen
              is what the advisor is actually being told is the one thing this
              page exists to be unambiguous about. */}
          <p role="status" className="text-meta text-ink-subtle">
            {emptied
              ? "Your advisor needs some instructions. Restore the default to start again."
              : edited
                ? "Not saved yet — your next message still uses the instructions below."
                : "Saved. This is what your next message sends."}
          </p>
        </div>

        <Restoring instructions={instructions} onRestore={onRestore} />
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-mono text-micro uppercase text-ink-subtle">
            What actually gets sent
          </h2>
          <p className="text-meta text-ink-subtle">
            Your instructions, with everything the application composes around them:
            what the advisor has learned about you, the plan of the conversation you came
            from, and the rules about looking things up and about what it reads on the
            web. That part is not editable, and this is the whole of it.
          </p>
          {edited && (
            <p className="text-meta text-ink">
              Showing the instructions as they are saved. Save to see your edit in it.
            </p>
          )}
        </div>

        {/* Wrapped rather than scrolled sideways: a prompt read on a phone is
            still the whole prompt. Focusable, because a block this tall has to
            be scrollable by someone who is not holding a mouse. */}
        <pre
          tabIndex={0}
          aria-label="The composed prompt"
          className="max-h-[32rem] overflow-y-auto overscroll-contain rounded-panel border border-line bg-sunken p-3 font-mono text-meta break-words whitespace-pre-wrap text-ink-muted"
        >
          {instructions.composed}
        </pre>
      </section>
    </>
  );
}

/**
 * Putting the shipped instructions back.
 *
 * Asked once before it happens, with named controls rather than an undo nobody
 * is offered — the same two-step the Conversation list deletes a row with,
 * because this throws away what the traveler wrote. Not offered at all when
 * what is in force is already the default: a control that would do nothing
 * says nothing.
 */
function Restoring({
  instructions,
  onRestore,
}: {
  instructions: AdvisorInstructions;
  onRestore: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (instructions.is_default) {
    // Said rather than drawn as a control that would do nothing — and said at
    // all, because a traveler about to rewrite their advisor wants to know
    // before they start that there is a way back.
    return (
      <p className="text-meta text-ink-subtle">
        These are the instructions your advisor ships with. Once you have changed them,
        you can restore these from here at any time.
      </p>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="flex items-center gap-1.5 self-start rounded-control px-1 py-0.5 text-meta text-ink-muted pressable hover:text-ink"
        onClick={() => setConfirming(true)}
      >
        <RotateCcw {...smallIcon} aria-hidden="true" />
        Restore the default
      </button>
    );
  }

  return (
    <div
      className="flex flex-col gap-2"
      onKeyDown={(pressed) => {
        // Escape puts the question away, as it would any other disclosure.
        if (pressed.key === "Escape") {
          pressed.stopPropagation();
          setConfirming(false);
        }
      }}
    >
      <p className="text-meta text-ink">
        This replaces what you have written with the instructions the advisor ships with,
        from your next message onwards.
      </p>
      <div className="flex items-center gap-1 text-meta">
        <button
          type="button"
          className="rounded-control px-2 py-1 font-medium text-error underline decoration-1 underline-offset-2"
          onClick={() => {
            setConfirming(false);
            onRestore();
          }}
        >
          Restore the default
        </button>
        <button
          type="button"
          className="rounded-control px-2 py-1 text-ink-muted underline decoration-1 underline-offset-2"
          onClick={() => setConfirming(false)}
        >
          Keep mine
        </button>
      </div>
    </div>
  );
}
