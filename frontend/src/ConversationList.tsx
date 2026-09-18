import { Compass, Plus, Trash2 } from "lucide-react";

import type { ConversationSummary } from "./api";
import { conversationName } from "./conversationName";
import { icon, smallIcon } from "./design/icons";

export function ConversationList({
  conversations,
  currentId,
  confirmingDelete,
  onStart,
  onOpen,
  onConfirmDelete,
  onDelete,
}: {
  conversations: ConversationSummary[];
  /** The Conversation being read, if any of them is. */
  currentId: string | null;
  /** The Conversation whose delete control has been asked once, if any. */
  confirmingDelete: string | null;
  onStart: () => void;
  onOpen: (id: string) => void;
  onConfirmDelete: (id: string | null) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Conversations"
      className="flex w-rail shrink-0 flex-col border-r border-line bg-sunken"
    >
      <div className="flex flex-col gap-4 px-4 pt-5 pb-4">
        <p className="flex items-center gap-2 font-display text-title font-semibold text-ink">
          <Compass {...icon} className="shrink-0 text-accent" aria-hidden="true" />
          Travel Advisor
        </p>

        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-3 py-2 text-meta font-medium text-ink shadow-raised transition-colors hover:bg-canvas"
          onClick={onStart}
        >
          <Plus {...smallIcon} aria-hidden="true" />
          New conversation
        </button>
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4">
        {conversations.map((conversation) => {
          const named = conversationName(conversation.title);
          const open = conversation.id === currentId;
          return (
            <li key={conversation.id}>
              <div
                className={`flex items-center gap-1 rounded-control pr-1 transition-colors ${
                  open ? "bg-surface shadow-raised" : "hover:bg-canvas"
                }`}
              >
                <button
                  type="button"
                  aria-current={open ? "true" : undefined}
                  className="min-w-0 flex-1 truncate rounded-control py-2 pl-3 text-left text-meta text-ink"
                  onClick={() => onOpen(conversation.id)}
                >
                  <span className={open ? "font-medium" : undefined}>{named}</span>
                </button>

                {confirmingDelete === conversation.id ? (
                  // Named controls rather than a hidden gesture, so the action
                  // is discoverable and says what it will do.
                  <span className="flex shrink-0 items-center gap-1 text-micro">
                    <button
                      type="button"
                      className="rounded-control px-1.5 py-1 font-medium text-error underline decoration-1 underline-offset-2"
                      onClick={() => onDelete(conversation.id)}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="rounded-control px-1.5 py-1 text-ink-muted underline decoration-1 underline-offset-2"
                      onClick={() => onConfirmDelete(null)}
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    // Permanently visible rather than revealed on hover: a
                    // control whose only affordance is a pointer is a control
                    // a touch screen cannot reach (ADR-0007).
                    aria-label={`Delete ${named}`}
                    className="shrink-0 rounded-control p-1.5 text-ink-subtle transition-colors hover:text-error"
                    onClick={() => onConfirmDelete(conversation.id)}
                  >
                    <Trash2 {...smallIcon} aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
