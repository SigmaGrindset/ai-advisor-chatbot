import { Compass, MoreHorizontal, Plus, Trash2 } from "lucide-react";

import type { ConversationSummary } from "../../api/types";
import { conversationName } from "./conversationName";
import { icon, smallIcon } from "../../design/icons";

/**
 * The row whose actions are showing, and whether it has been asked to delete.
 *
 * One row at a time: opening a second row's actions closes the first, so the
 * list never has two half-finished decisions in it.
 */
export type RowActions = { id: string; confirming: boolean };

export function ConversationList({
  conversations,
  currentId,
  actions,
  onStart,
  onOpen,
  onActions,
  onDelete,
}: {
  conversations: ConversationSummary[];
  /** The Conversation being read, if any of them is. */
  currentId: string | null;
  /** The row whose actions are open, if one of them is. */
  actions: RowActions | null;
  onStart: () => void;
  onOpen: (id: string) => void;
  onActions: (actions: RowActions | null) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Conversations"
      className="flex h-full min-h-0 w-full flex-col bg-sunken"
      onKeyDown={(pressed) => {
        // Escape puts a row's actions away, as it would any other disclosure.
        // Inside a sheet the dialog takes the second press and closes it.
        if (pressed.key === "Escape" && actions !== null) {
          pressed.stopPropagation();
          onActions(null);
        }
      }}
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

      {/* Contained, so that flicking this list past its end scrolls neither
          the transcript behind it nor the page itself. */}
      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2 pb-4">
        {conversations.length === 0 && (
          // An empty list is the ordinary state of a first visit, so it says
          // what will fill it rather than leaving the rail looking broken.
          <li className="px-3 py-2 text-meta text-ink-subtle">
            Conversations you start appear here.
          </li>
        )}

        {conversations.map((conversation) => {
          const named = conversationName(conversation.title);
          const open = conversation.id === currentId;
          const showing = actions?.id === conversation.id ? actions : null;
          const strip = `${conversation.id}-actions`;
          return (
            <li key={conversation.id}>
              <div
                className={`flex flex-col rounded-control transition-colors ${
                  open ? "bg-surface shadow-raised" : "hover:bg-canvas"
                }`}
              >
                <div className="flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    aria-current={open ? "true" : undefined}
                    className="min-w-0 flex-1 truncate rounded-control py-2 pl-3 text-left text-meta text-ink"
                    onClick={() => onOpen(conversation.id)}
                  >
                    <span className={open ? "font-medium" : undefined}>{named}</span>
                  </button>

                  {/* The row's actions live behind one permanently visible
                      control rather than behind hovering the row or swiping
                      it. A pointer is an affordance a touch screen has not
                      got, and a swipe is one nothing tells the traveler
                      about — and would fight the sheet this list sits in on a
                      phone besides (ADR-0007). */}
                  <button
                    type="button"
                    aria-label={`Actions for ${named}`}
                    aria-expanded={showing !== null}
                    aria-controls={showing !== null ? strip : undefined}
                    className="shrink-0 rounded-control p-2 text-ink-subtle transition-colors hover:text-ink"
                    onClick={() =>
                      onActions(showing === null ? { id: conversation.id, confirming: false } : null)
                    }
                  >
                    <MoreHorizontal {...smallIcon} aria-hidden="true" />
                  </button>
                </div>

                {showing !== null && (
                  <div id={strip} className="flex items-center gap-1 px-2 pb-2 text-meta">
                    {showing.confirming ? (
                      // Named controls rather than an undo nobody is offered:
                      // deleting a Conversation cannot be taken back.
                      <>
                        <button
                          type="button"
                          className="rounded-control px-2 py-1 font-medium text-error underline decoration-1 underline-offset-2"
                          onClick={() => onDelete(conversation.id)}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="rounded-control px-2 py-1 text-ink-muted underline decoration-1 underline-offset-2"
                          onClick={() => onActions(null)}
                        >
                          Keep
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-control px-2 py-1 text-ink-muted transition-colors hover:text-error"
                        onClick={() => onActions({ id: conversation.id, confirming: true })}
                      >
                        <Trash2 {...smallIcon} aria-hidden="true" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
