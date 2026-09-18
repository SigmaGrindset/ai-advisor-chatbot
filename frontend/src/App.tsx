import { useEffect, useState } from "react";

import { deleteConversation, listConversations, readConversation } from "./api/client";
import type { Conversation, ConversationSummary } from "./api/types";
import { ConversationList, type RowActions } from "./components/conversation/ConversationList";
import { ConversationPane } from "./components/conversation/ConversationPane";
import { RecordPane } from "./components/record/RecordPane";
import { AppShell } from "./components/shell/AppShell";
import { useTurn } from "./stream/useTurn";

/**
 * The Conversations, and what shows them.
 *
 * What the traveler has said and been told is held here, at the one place
 * both the list and the open Conversation can be revised from — a turn adds a
 * Message to the Conversation being read *and* moves its row to the top of
 * the list, and two copies of that would disagree. The turn itself is
 * `useTurn`, and the arrangement of panes and sheets is `AppShell`.
 */
export function App() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  // Null is a Conversation the traveler has begun but not yet said anything in.
  // It has no row in the list and no row in the database until they do.
  const [current, setCurrent] = useState<Conversation | null>(null);
  const [rowActions, setRowActions] = useState<RowActions | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const turn = useTurn({
    conversation: current,
    onConversation: setCurrent,
    onListed: setConversations,
    onAsking: () => {
      // What the page was showing around the Conversation, which a new turn
      // supersedes. What the last turn left in it the turn puts down itself.
      setRowActions(null);
      setFailure(null);
    },
    onFailure: setFailure,
  });

  useEffect(() => {
    // The most recently active Conversation is the one they were working in, so
    // a reload puts them back rather than somewhere they have to navigate from.
    void resume()
      .then(([listed, opened]) => {
        setConversations(listed);
        setCurrent(opened);
      })
      .catch(() => setFailure("Your conversations could not be loaded."));
  }, []);

  /** Everything the page is showing about a Conversation, put down. */
  function clear() {
    setRowActions(null);
    setFailure(null);
    turn.forget();
  }

  function start() {
    clear();
    setCurrent(null);
  }

  async function open(id: string) {
    setRowActions(null);
    if (id === current?.id) return;
    clear();
    try {
      setCurrent(await readConversation(id));
    } catch {
      setFailure("That conversation could not be opened.");
    }
  }

  async function remove(id: string) {
    setRowActions(null);
    setFailure(null);
    try {
      await deleteConversation(id);
      const remaining = conversations.filter((conversation) => conversation.id !== id);
      setConversations(remaining);
      if (id !== current?.id) return;
      clear();
      // They deleted what they were reading, so something has to take its place:
      // the next one down, or a blank Conversation if that was the last of them.
      const next = remaining[0];
      setCurrent(next === undefined ? null : await readConversation(next.id));
    } catch {
      setFailure("That conversation could not be deleted.");
    }
  }

  return (
    <AppShell
      list={(dismiss) => (
        <ConversationList
          conversations={conversations}
          currentId={current?.id ?? null}
          actions={rowActions}
          onStart={() => {
            start();
            dismiss();
          }}
          onOpen={(id) => {
            dismiss();
            void open(id);
          }}
          onActions={setRowActions}
          onDelete={(id) => void remove(id)}
        />
      )}
      conversation={(folded) => (
        <ConversationPane
          conversation={current}
          arriving={turn.arriving}
          consulting={turn.consulting}
          trouble={turn.trouble}
          stopped={turn.stopped}
          failure={failure}
          draft={turn.draft}
          sending={turn.sending}
          onDraft={turn.setDraft}
          onSend={turn.send}
          onStop={turn.stop}
          onRetry={turn.again}
          onShowConversations={folded.conversations}
          onShowRecord={folded.record}
        />
      )}
      record={<RecordPane />}
    />
  );
}

/** What to show on arrival: every Conversation, and the one last worked in. */
async function resume(): Promise<[ConversationSummary[], Conversation | null]> {
  const listed = await listConversations();
  const mostRecent = listed[0];
  if (mostRecent === undefined) return [listed, null];
  return [listed, await readConversation(mostRecent.id)];
}
