import { useEffect, useRef, useState } from "react";

import {
  addItineraryItem,
  changeItineraryItem,
  changePlan,
  deleteConversation,
  listConversations,
  readConversation,
  removeItineraryItem,
  settleOpenQuestion,
} from "./api/client";
import type {
  Conversation,
  ConversationRead,
  ConversationSummary,
  TripPlan,
} from "./api/types";
import { ConversationList, type RowActions } from "./components/conversation/ConversationList";
import { ConversationPane } from "./components/conversation/ConversationPane";
import { asPatch, isScalar } from "./components/plan/fields";
import { usePlanHolding } from "./components/plan/holding";
import { PlanPanel } from "./components/plan/PlanPanel";
import { PlanPeek } from "./components/plan/PlanPeek";
import { questionPrompt } from "./components/plan/questionPrompt";
import { RecordPane, type RecordTab } from "./components/record/RecordPane";
import { AppShell } from "./components/shell/AppShell";
import { useTurn } from "./stream/useTurn";

/**
 * The Conversations, the Trip Plan one of them is producing, and what shows
 * them.
 *
 * What the traveler has said and been told is held here, at the one place
 * both the list and the open Conversation can be revised from — a turn adds a
 * Message to the Conversation being read *and* moves its row to the top of
 * the list, and two copies of that would disagree. The plan is held here for
 * the same reason and one more: it is shown in two places at once on a phone,
 * as a sheet and as the strip above the composer.
 *
 * The turn itself is `useTurn`, what becomes of a plan two people are writing
 * to is `plan/holding`, and the arrangement of panes and sheets is `AppShell`.
 */
export function App() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  // Null is a Conversation the traveler has begun but not yet said anything in.
  // It has no row in the list and no row in the database until they do.
  const [current, setCurrent] = useState<Conversation | null>(null);
  const [rowActions, setRowActions] = useState<RowActions | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [tab, setTab] = useState<RecordTab>("plan");
  // A change to the plan that arrived while the Plan tab was not showing. The
  // tab is marked with it rather than switched to (ADR-0006 keeps the plan in
  // view; it does not take the other record away to do it).
  const [unseen, setUnseen] = useState(false);
  // Which record is showing, kept where a turn can read it. A turn outlives
  // the render that started it, so the tab it closed over is the tab that was
  // open when the traveler pressed send and not the one they are looking at
  // when the plan actually moves.
  const showingTab = useRef(tab);
  useEffect(() => {
    showingTab.current = tab;
  }, [tab]);

  const plan = usePlanHolding();

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
    onBegan: (conversationId) => plan.opened(conversationId, null),
    onPlanRevised: (conversationId, revised, changed) => {
      plan.revised(conversationId, revised, changed);
      if (showingTab.current !== "plan") setUnseen(true);
    },
  });

  useEffect(() => {
    // The most recently active Conversation is the one they were working in, so
    // a reload puts them back rather than somewhere they have to navigate from.
    void resume()
      .then(([listed, opened]) => {
        setConversations(listed);
        if (opened === null) return;
        const { plan: refining, ...conversation } = opened;
        setCurrent(conversation);
        plan.opened(conversation.id, refining);
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
    plan.opened(null, null);
  }

  async function open(id: string) {
    setRowActions(null);
    if (id === current?.id) return;
    clear();
    try {
      await show(id);
    } catch {
      setFailure("That conversation could not be opened.");
    }
  }

  /** Read a Conversation and put it, and the plan it is refining, on screen. */
  async function show(id: string) {
    const { plan: refining, ...conversation } = await readConversation(id);
    setCurrent(conversation);
    plan.opened(conversation.id, refining);
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
      if (next === undefined) start();
      else await show(next.id);
    } catch {
      setFailure("That conversation could not be deleted.");
    }
  }

  /**
   * One change the traveler made to the plan themselves.
   *
   * Every one of these answers with the whole plan, so there is nothing to
   * reconcile: what comes back is what is shown, bar whatever field they have
   * moved on to editing since.
   */
  function byHand(changing: (tripId: string) => Promise<TripPlan>) {
    const tripId = plan.plan?.trip_id;
    if (tripId === undefined) return;
    void changing(tripId)
      .then(plan.replaced)
      .catch(() => setFailure("That change to your trip could not be saved."));
  }

  /** Save one field: a scalar by its name, an Itinerary Item by its identifier. */
  function save(field: string, value: string) {
    if (isScalar(field)) {
      const patch = asPatch(field, value);
      // Text that is not a value the field could hold is not a change and not
      // an instruction to empty it, so there is nothing to send.
      if (Object.keys(patch).length === 0) return;
      byHand((tripId) => changePlan(tripId, patch));
      return;
    }
    // An Itinerary Item cleared to nothing is not a request to delete it. The
    // editor opens with its text selected, so one Backspace and a click away
    // would otherwise destroy the row silently; removing one is the control
    // beside it, which says what it does.
    if (value === "") return;
    byHand((tripId) => changeItineraryItem(tripId, field, value));
  }

  const planPanel = (
    <PlanPanel
      plan={plan.plan}
      lit={plan.lit}
      suggestions={plan.suggestions}
      onEditing={plan.editing}
      onSave={save}
      onDismiss={plan.settled}
      onAdd={(day, description) =>
        byHand((tripId) => addItineraryItem(tripId, { day, description }))
      }
      onRemove={(itemId) => byHand((tripId) => removeItineraryItem(tripId, itemId))}
      onAsk={(question) => turn.setDraft(questionPrompt(question))}
      onSettle={(questionId) => byHand((tripId) => settleOpenQuestion(tripId, questionId))}
    />
  );

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
          peek={folded.peek}
        />
      )}
      record={
        <RecordPane
          tab={tab}
          onTab={(showing) => {
            setTab(showing);
            if (showing === "plan") setUnseen(false);
          }}
          unseen={unseen}
          plan={planPanel}
        />
      }
      peek={(showRecord) => (
        <PlanPeek
          plan={plan.plan}
          lit={plan.lit}
          onOpen={() => {
            // The strip says where and when, so the record has to come out at
            // the thing it was showing rather than at whichever tab was last
            // looked at.
            setTab("plan");
            setUnseen(false);
            showRecord();
          }}
        />
      )}
    />
  );
}

/** What to show on arrival: every Conversation, and the one last worked in. */
async function resume(): Promise<[ConversationSummary[], ConversationRead | null]> {
  const listed = await listConversations();
  const mostRecent = listed[0];
  if (mostRecent === undefined) return [listed, null];
  return [listed, await readConversation(mostRecent.id)];
}
