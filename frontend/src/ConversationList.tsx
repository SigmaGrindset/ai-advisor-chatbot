import type { ConversationSummary } from "./api";

/** An unnamed Conversation still needs saying out loud in the list. */
const UNNAMED = "New conversation";

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
      className="flex w-64 shrink-0 flex-col gap-2 border-r border-neutral-200 p-4"
    >
      <button
        type="button"
        className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium"
        onClick={onStart}
      >
        New conversation
      </button>

      <ul className="flex flex-col gap-1 overflow-y-auto">
        {conversations.map((conversation) => (
          <li key={conversation.id} className="flex items-center gap-1">
            <button
              type="button"
              aria-current={conversation.id === currentId ? "true" : undefined}
              className={`flex-1 truncate rounded px-2 py-1.5 text-left text-sm ${
                conversation.id === currentId
                  ? "bg-neutral-200 font-medium"
                  : "hover:bg-neutral-100"
              }`}
              onClick={() => onOpen(conversation.id)}
            >
              {conversation.title ?? UNNAMED}
            </button>

            {confirmingDelete === conversation.id ? (
              <span className="flex gap-1 text-xs">
                <button
                  type="button"
                  className="rounded px-1.5 py-1 text-red-700 underline"
                  onClick={() => onDelete(conversation.id)}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 py-1 underline"
                  onClick={() => onConfirmDelete(null)}
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                // A named control rather than a hidden gesture, so the action is
                // discoverable and says what it will act on.
                aria-label={`Delete ${conversation.title ?? UNNAMED}`}
                className="rounded px-2 py-1 text-neutral-500 hover:text-neutral-900"
                onClick={() => onConfirmDelete(conversation.id)}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
