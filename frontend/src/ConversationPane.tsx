import { useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";

import type { Conversation, Message } from "./api";
import { Composer } from "./Composer";
import { conversationName } from "./conversationName";
import { smallIcon } from "./design/icons";

export function ConversationPane({
  conversation,
  arriving,
  failure,
  draft,
  sending,
  onDraft,
  onSend,
}: {
  /** The Conversation being read, or null before the traveler has begun one. */
  conversation: Conversation | null;
  /** The reply as it is being written, if one is arriving into this Conversation. */
  arriving: string | null;
  failure: string | null;
  draft: string;
  /** True while a turn is in flight, whichever Conversation it belongs to. */
  sending: boolean;
  onDraft: (draft: string) => void;
  onSend: () => void;
}) {
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Follow the reply as it is written. Staying put when the traveler has
    // scrolled up is a later ticket's job.
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight });
  }, [conversation, arriving]);

  const empty = (conversation?.messages.length ?? 0) === 0 && arriving === null;

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-canvas">
      <header className="flex shrink-0 items-center border-b border-line px-6 py-4">
        <h1 className="truncate font-display text-title font-semibold text-ink">
          {conversationName(conversation?.title ?? null)}
        </h1>
      </header>

      <div ref={transcript} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex max-w-reading flex-col gap-8">
          {empty && (
            // An empty Conversation is the first thing a traveler sees, so it
            // is set as an opening rather than left as a gap. The composed
            // greeting and the starter prompts are 05's.
            <p className="max-w-[22ch] pt-2 font-display text-display text-ink-muted">
              Ask about a trip you are planning, and the advisor will answer here.
            </p>
          )}

          {conversation?.messages.map((message) => (
            <MessageView key={message.id} role={message.role} content={message.content} />
          ))}

          {arriving !== null && <MessageView role="advisor" content={arriving} writing />}

          {failure !== null && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-panel bg-error-tint px-4 py-3 text-meta text-error"
            >
              <TriangleAlert {...smallIcon} className="mt-0.5 shrink-0" aria-hidden="true" />
              {failure}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-line px-6 pt-4 pb-composer">
        <Composer draft={draft} sending={sending} onDraft={onDraft} onSend={onSend} />
      </div>
    </main>
  );
}

function MessageView({
  role,
  content,
  writing = false,
}: {
  role: Message["role"];
  content: string;
  /** True while this Message is still being written into the Conversation. */
  writing?: boolean;
}) {
  const traveler = role === "traveler";
  return (
    <article className="flex flex-col gap-2">
      <h2 className="font-mono text-micro uppercase text-ink-subtle">
        {traveler ? "You" : "Advisor"}
      </h2>
      {/* Enough of a treatment that the transcript is not browser defaults:
          the two voices are set in different faces rather than boxed. What the
          chat finally reads like — rendered Markdown, retry, the stop control
          — is 05's. */}
      <p
        className={`whitespace-pre-wrap text-ink ${
          traveler ? "font-display text-title font-medium" : "text-body"
        }`}
      >
        {content}
        {writing && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block h-[1lh] w-[2px] translate-y-[3px] animate-caret bg-accent align-baseline"
          />
        )}
      </p>
    </article>
  );
}
