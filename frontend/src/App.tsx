import { useEffect, useRef, useState } from "react";

import {
  addItineraryItem,
  attachConversation,
  changeItineraryItem,
  changePlan,
  clearEverything,
  deleteConversation,
  deleteTrip,
  forgetProfileFact,
  listConversations,
  listTrips,
  readConversation,
  readInstructions,
  readProfile,
  removeItineraryItem,
  renameConversation,
  restoreInstructions,
  saveInstructions,
  settleOpenQuestion,
} from "./api/client";
import type {
  AdvisorInstructions,
  Conversation,
  ConversationRead,
  ConversationSummary,
  ProfileFact,
  TripPlan,
} from "./api/types";
import { ConversationList, type RowActions } from "./components/conversation/ConversationList";
import { ConversationPane } from "./components/conversation/ConversationPane";
import { asPatch, isScalar } from "./components/plan/fields";
import { usePlanHolding } from "./components/plan/holding";
import { PlanPanel } from "./components/plan/PlanPanel";
import { PlanPeek } from "./components/plan/PlanPeek";
import { questionPrompt } from "./components/plan/questionPrompt";
import { ProfilePanel } from "./components/profile/ProfilePanel";
import { RecordPane, type RecordTab } from "./components/record/RecordPane";
import { AppFrame } from "./components/shell/AppFrame";
import { AppShell } from "./components/shell/AppShell";
import { withPlan } from "./components/trip/listing";
import { TripSwitcher } from "./components/trip/TripSwitcher";
import { InstructionsPage } from "./routes/InstructionsPage";
import { goTo, useRoute } from "./routes/routing";
import { type OnDeletingTrip, TripsPage } from "./routes/TripsPage";
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
 * The Trips are held here for a third: one turn can start a Trip, name it and
 * attach the Conversation to it all at once, and the chip in the list, the
 * switcher over the plan and the page listing every Trip all have to say the
 * same thing about it a moment later. What a page shows is the route's
 * question; what is true is this one's, which is why the state lives above
 * both screens and a page cannot take a running turn down with it.
 *
 * The turn itself is `useTurn`, what becomes of a plan two people are writing
 * to is `plan/holding`, and the arrangement of panes and sheets is `AppShell`.
 */
export function App() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  // Every Trip the traveler has. Kept rather than re-read: a Trip is born
  // mid-turn, and the plan the turn sends back is the whole of the new Trip,
  // so a refetch would say the same thing a round trip later — with the chip
  // beside the Conversation arriving after the plan it belongs to.
  const [trips, setTrips] = useState<TripPlan[]>([]);
  // Everything the advisor durably knows about the traveler. It belongs to no
  // Conversation — every one of them is shown it and any one of them can add
  // to it — so it is held here rather than beside the open Conversation.
  const [profile, setProfile] = useState<ProfileFact[]>([]);
  // Null is a Conversation the traveler has begun but not yet said anything in.
  // It has no row in the list and no row in the database until they do.
  const [current, setCurrent] = useState<Conversation | null>(null);
  // What the advisor is told, and the prompt it composes into. Read when that
  // page is opened rather than on arrival: nothing else shows it, and the
  // composed prompt is only true of the moment it was asked for — the plan and
  // the profile it carries move as the traveler talks.
  const [instructions, setInstructions] = useState<AdvisorInstructions | null>(null);
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [rowActions, setRowActions] = useState<RowActions | null>(null);
  // The Conversation whose name the traveler is editing in the list, if they
  // are. Held here rather than in the list, because the list is rebuilt from
  // the top every time a turn moves a row to it.
  const [renaming, setRenaming] = useState<string | null>(null);
  // True until the first read of everything has come back, however it came
  // back. Every pane holds an empty state, and an empty state shown before
  // anything has been read is a statement about the traveler's account that
  // nothing has checked — so until this is false the panes stand in shapes
  // instead (`shell/Skeleton.tsx`).
  const [resuming, setResuming] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [tab, setTab] = useState<RecordTab>("plan");
  // The records that changed while their tab was not showing. The tab is
  // marked rather than switched to (ADR-0006 keeps the plan in view; it does
  // not take the other record away to do it).
  const [unseen, setUnseen] = useState<ReadonlySet<RecordTab>>(EMPTY);
  // Which record is showing, kept where a turn can read it. A turn outlives
  // the render that started it, so the tab it closed over is the tab that was
  // open when the traveler pressed send and not the one they are looking at
  // when the plan actually moves.
  const showingTab = useRef(tab);
  useEffect(() => {
    showingTab.current = tab;
  }, [tab]);

  const plan = usePlanHolding();
  const route = useRoute();

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
      // The turn may have started this Trip or joined another, so the list
      // and the row both hear about it from the same event — a chip that
      // appeared a request later would be a chip that appeared for no reason
      // the traveler watched happen.
      noteTrip(conversationId, revised);
      mark("plan");
    },
    onProfileRevised: (learned) => {
      setProfile(learned);
      mark("traveler");
    },
  });

  useEffect(() => {
    // The most recently active Conversation is the one they were working in, so
    // a reload puts them back rather than somewhere they have to navigate from.
    void resume()
      .then(([listed, planned, known, opened]) => {
        setConversations(listed);
        setTrips(planned);
        setProfile(known);
        if (opened === null) return;
        const { plan: refining, ...conversation } = opened;
        setCurrent(conversation);
        plan.opened(conversation.id, refining);
      })
      .catch(() => setFailure("Your conversations could not be loaded."))
      // Put down whether the read worked or not. A read that failed has said
      // so in `failure`, and a pane left loading forever underneath the
      // sentence explaining why it will not load is two accounts of one thing.
      .finally(() => setResuming(false));
  }, []);

  useEffect(() => {
    // Whatever the screen they are leaving was saying, the move supersedes.
    setFailure(null);
  }, [route]);

  useEffect(() => {
    if (route !== "instructions") {
      // Put down rather than kept: the composed prompt carries the plan and
      // the profile as they stood, and showing yesterday's on the way back in
      // would be showing something that is not what the next message sends.
      setInstructions(null);
      return;
    }
    // What came back for a Conversation that is no longer the one being read
    // is dropped rather than shown. A traveler arriving at this address has
    // two reads in flight — the one this page makes before `resume` has said
    // which Conversation they were in, and the one it makes when it has — and
    // the first of them answering last would leave a prompt on screen that is
    // not the one their next message sends.
    let reading = true;
    void readInstructions(current?.id ?? null)
      .then((read) => {
        if (reading) setInstructions(read);
      })
      .catch(() => {
        if (reading) setFailure("Your advisor's instructions could not be read.");
      });
    return () => {
      reading = false;
    };
    // Read again when the Conversation under it changes, which is what a
    // traveler who arrived at this address rather than navigating to it does:
    // on a reload or a bookmark the page is drawn before `resume` has said
    // which Conversation they were in, and a prompt composed without that
    // Conversation's Trip Plan is not the prompt their next message sends.
  }, [route, current?.id]);

  /** Mark a record as changed, unless the traveler is looking straight at it. */
  function mark(record: RecordTab) {
    if (showingTab.current === record) return;
    setUnseen((sofar) => new Set(sofar).add(record));
  }

  /** Everything the page is showing about a Conversation, put down. */
  function clear() {
    setRowActions(null);
    setRenaming(null);
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

  /**
   * Call a Conversation something the traveler will recognise it by.
   *
   * What the server stored is what is shown afterwards, in both places a
   * Conversation is named: the row they typed into, and the heading over the
   * transcript if that is the one they are reading.
   */
  function rename(id: string, title: string) {
    setFailure(null);
    void renameConversation(id, title)
      .then((renamed) => {
        setConversations((sofar) =>
          sofar.map((row) => (row.id === id ? { ...row, title: renamed.title } : row)),
        );
        setCurrent((reading) =>
          reading?.id === id ? { ...reading, title: renamed.title } : reading,
        );
      })
      .catch(() => setFailure("That conversation could not be renamed."));
  }

  async function remove(id: string) {
    setRowActions(null);
    setFailure(null);
    try {
      await deleteConversation(id);
      await afterDeleting(
        conversations.filter((conversation) => conversation.id !== id),
        (gone) => gone === id,
      );
    } catch {
      setFailure("That conversation could not be deleted.");
    }
  }

  /**
   * The list as it stands once some Conversations have gone, and the traveler
   * put somewhere if they were reading one of them.
   *
   * Two gestures end here — deleting one Conversation, and deleting a Trip
   * with its Conversations — and what has to happen afterwards is the same
   * either way: something has to take the place of what they were reading.
   * The next one down, or a blank Conversation if that was the last of them.
   */
  async function afterDeleting(
    remaining: ConversationSummary[],
    deleted: (id: string) => boolean,
  ) {
    setConversations(remaining);
    if (current === null || !deleted(current.id)) return;
    clear();
    const next = remaining[0];
    if (next === undefined) start();
    else await show(next.id);
  }

  /**
   * Delete a Trip, and do what the traveler decided about its Conversations.
   *
   * The plan goes either way. The Conversations are the part they answered a
   * question about, and both answers have somewhere to land here: deleted,
   * they leave the list the same way one deleted on its own does; kept, they
   * come off the Trip and are listed under none, which is where every
   * Conversation starts.
   *
   * Which ones those are is worked out from what this page was showing rather
   * than read back from the server. It is the same answer, and it is the set
   * of rows the traveler was actually looking at when they decided.
   */
  async function discard(tripId: string, going: OnDeletingTrip) {
    setFailure(null);
    try {
      await deleteTrip(tripId, going);
    } catch {
      setFailure("That trip could not be deleted.");
      return;
    }
    setTrips((sofar) => sofar.filter((trip) => trip.trip_id !== tripId));
    // The plan pane is showing a Trip that no longer exists, whichever way
    // they answered — so it is emptied before anything else is decided.
    if (plan.plan?.trip_id === tripId && current !== null) plan.opened(current.id, null);
    if (going === "keep") {
      setConversations((sofar) =>
        sofar.map((row) => (row.trip_id === tripId ? { ...row, trip_id: null } : row)),
      );
      return;
    }
    const gone = new Set(
      conversations.filter((row) => row.trip_id === tripId).map((row) => row.id),
    );
    await afterDeleting(
      conversations.filter((row) => !gone.has(row.id)),
      (id) => gone.has(id),
    );
  }

  /** Take one thing the advisor learned off the Traveler Profile. */
  function forget(factId: string) {
    setFailure(null);
    void forgetProfileFact(factId)
      .then(setProfile)
      .catch(() => setFailure("That could not be deleted from your profile."));
  }

  /**
   * Change how the advisor behaves, or put back the way it shipped.
   *
   * Both answer with the instructions *and* the prompt they now compose into,
   * so what the traveler is shown after the change is the server's own
   * composition of what they just saved rather than the page's guess at it.
   */
  function revise(saving: Promise<AdvisorInstructions>, trouble: string) {
    setFailure(null);
    setSavingInstructions(true);
    void saving
      .then(setInstructions)
      .catch(() => setFailure(trouble))
      .finally(() => setSavingInstructions(false));
  }

  /**
   * Leave nothing behind.
   *
   * Everything on screen goes with it rather than being re-read: what the
   * traveler is looking at afterwards is a first visit, and asking the server
   * what it holds now would be asking a question already answered.
   */
  function erase() {
    setFailure(null);
    void clearEverything()
      .then(() => {
        setConversations([]);
        setTrips([]);
        setProfile([]);
        setUnseen(EMPTY);
        start();
      })
      .catch(() => setFailure("Your data could not be deleted."));
  }

  /**
   * A plan that has arrived, filed where the rest of the interface reads it
   * from: the Trips list, and the row of the Conversation refining it.
   *
   * Both from the one plan, because both are answers to the same question.
   * A Conversation whose Trip changed mid-turn and a list that has not heard
   * of the Trip would leave a row marked with a colour nothing explains.
   */
  function noteTrip(conversationId: string, refining: TripPlan) {
    setTrips((sofar) => withPlan(sofar, refining));
    markTrip(conversationId, refining.trip_id);
  }

  /** Say on a Conversation's row which Trip it is refining. */
  function markTrip(conversationId: string, tripId: string | null) {
    setConversations((sofar) =>
      sofar.map((row) => (row.id === conversationId ? { ...row, trip_id: tripId } : row)),
    );
  }

  /**
   * Put this Conversation on a Trip, or take it off the one it is on.
   *
   * The advisor is the one that decides what a Conversation is about, and it
   * is working from a list of Trips it was shown — so it can attach one to the
   * wrong journey, and only the traveler can say so (ADR-0002).
   */
  function attach(tripId: string | null) {
    const conversationId = current?.id;
    if (conversationId === undefined) return;
    void attachConversation(conversationId, tripId)
      .then((refining) => {
        plan.opened(conversationId, refining);
        markTrip(conversationId, tripId);
        if (refining !== null) setTrips((sofar) => withPlan(sofar, refining));
      })
      .catch(() => setFailure("This conversation could not be moved to that trip."));
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
      .then((revised) => {
        plan.replaced(revised);
        // The page that lists every Trip shows what the traveler just typed
        // into this one, so it hears about it from the same answer.
        setTrips((sofar) => withPlan(sofar, revised));
      })
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
      resuming={resuming}
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

  if (route === "trips") {
    return (
      <AppFrame>
        <TripsPage
          trips={trips}
          conversations={conversations}
          currentId={current?.id ?? null}
          failure={failure}
          onDelete={(tripId, going) => void discard(tripId, going)}
          onOpen={(id) => {
            // Opening one is also the way back to it: a traveler who came
            // here to find a Conversation has found it.
            goTo("conversations");
            void open(id);
          }}
          onBack={() => goTo("conversations")}
        />
      </AppFrame>
    );
  }

  if (route === "instructions") {
    return (
      <AppFrame>
        <InstructionsPage
          instructions={instructions}
          saving={savingInstructions}
          failure={failure}
          onSave={(revised) =>
            revise(
              saveInstructions(revised, current?.id ?? null),
              "Your instructions could not be saved.",
            )
          }
          onRestore={() =>
            revise(
              restoreInstructions(current?.id ?? null),
              "The default instructions could not be restored.",
            )
          }
          onBack={() => goTo("conversations")}
        />
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <AppShell
        list={(dismiss) => (
          <ConversationList
            conversations={conversations}
            resuming={resuming}
            trips={trips}
            currentId={current?.id ?? null}
            actions={rowActions}
            renaming={renaming}
            onStart={() => {
              start();
              dismiss();
            }}
            onOpen={(id) => {
              dismiss();
              void open(id);
            }}
            onActions={setRowActions}
            onRenaming={setRenaming}
            onRename={rename}
            onDelete={(id) => void remove(id)}
            onTrips={() => {
              dismiss();
              goTo("trips");
            }}
            onInstructions={() => {
              dismiss();
              goTo("instructions");
            }}
          />
        )}
        conversation={(folded) => (
          <ConversationPane
            conversation={current}
            resuming={resuming}
            arriving={turn.arriving}
            consulting={turn.consulting}
            unrecorded={turn.unrecorded}
            stopped={turn.stopped}
            failure={failure}
            draft={turn.draft}
            sending={turn.sending}
            onDraft={turn.setDraft}
            onSend={turn.send}
            onStop={turn.stop}
            onRetry={turn.retry}
            onAskAgain={turn.again}
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
              setUnseen((sofar) => without(sofar, showing));
            }}
            unseen={unseen}
            switcher={
              // Nothing to switch on a Conversation that does not exist yet:
              // there is nothing to put on a Trip until they say something.
              current === null ? null : (
                <TripSwitcher plan={plan.plan} trips={trips} onChoose={attach} />
              )
            }
            plan={planPanel}
            traveler={
              <ProfilePanel profile={profile} onForget={forget} onClear={erase} />
            }
          />
        }
        peek={(showRecord) => (
          <PlanPeek
            plan={plan.plan}
            lit={plan.lit}
            onOpen={() => {
              // The strip says where and when, so the record has to come out
              // at the thing it was showing rather than at whichever tab was
              // last looked at.
              setTab("plan");
              setUnseen((sofar) => without(sofar, "plan"));
              showRecord();
            }}
          />
        )}
      />
    </AppFrame>
  );
}

/** No record has changed unseen, which is how every visit starts. */
const EMPTY: ReadonlySet<RecordTab> = new Set();

/** The same set without one of them, which is what looking at it does. */
function without(marked: ReadonlySet<RecordTab>, seen: RecordTab): ReadonlySet<RecordTab> {
  if (!marked.has(seen)) return marked;
  const left = new Set(marked);
  left.delete(seen);
  return left;
}

/**
 * What to show on arrival: every Conversation, every Trip, everything the
 * advisor knows about the traveler, and the one Conversation last worked in.
 *
 * The Trips come with the rest rather than when a page asks for them, because
 * the very first screen is already marked with which Trip each Conversation
 * is about. The profile comes with them because the pane beside the
 * Conversation has a tab showing it.
 */
async function resume(): Promise<
  [ConversationSummary[], TripPlan[], ProfileFact[], ConversationRead | null]
> {
  const [listed, planned, known] = await Promise.all([
    listConversations(),
    listTrips(),
    readProfile(),
  ]);
  const mostRecent = listed[0];
  if (mostRecent === undefined) return [listed, planned, known, null];
  return [listed, planned, known, await readConversation(mostRecent.id)];
}
