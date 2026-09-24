import { useEffect, useReducer, useRef, useState } from "react";

import {
  addItineraryItem,
  attachConversation,
  changeItineraryItem,
  changePlan,
  clearEverything,
  deleteConversation,
  deleteTrip,
  dismissGuestNotice,
  forgetProfileFact,
  guestNoticeDue,
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
 * The Conversations, the Trip Plan one of them is producing, and what shows them.
 *
 * All of it is held here because a single turn revises several views at once —
 * it adds a Message *and* moves the row to the top of the list, and can start a
 * Trip that the chip, the switcher and the Trips page must all agree about a
 * moment later. Two copies of that would disagree. State living above both
 * screens is also what stops a page taking a running turn down with it.
 *
 * The turn itself is `useTurn`, what becomes of a plan two people are writing
 * to is `plan/holding`, and the arrangement of panes and sheets is `AppShell`.
 */
export function App() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  // Kept rather than re-read: a Trip is born mid-turn and the plan the turn
  // sends back is the whole of it, so a refetch would only say the same thing
  // a round trip later — with the chip arriving after the plan it belongs to.
  const [trips, setTrips] = useState<TripPlan[]>([]);
  // Belongs to no Conversation: every one is shown it and any one can add to it.
  const [profile, setProfile] = useState<ProfileFact[]>([]);
  // Null is a Conversation begun but not yet spoken in. It has no row in the
  // list and none in the database until they say something.
  const [current, setCurrent] = useState<Conversation | null>(null);
  // Read when that page is opened rather than on arrival: the composed prompt
  // is only true of the moment it was asked for, since the plan and profile it
  // carries move as the traveler talks.
  const [instructions, setInstructions] = useState<AdvisorInstructions | null>(null);
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [rowActions, setRowActions] = useState<RowActions | null>(null);
  // Held here rather than in the list, which is rebuilt from the top every
  // time a turn moves a row to it.
  const [renaming, setRenaming] = useState<string | null>(null);
  // True until the first read has come back, however it came back. An empty
  // state shown before anything is read is a claim about the traveler's
  // account that nothing has checked, so the panes stand in shapes until then.
  const [resuming, setResuming] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [tab, setTab] = useState<RecordTab>("plan");
  // Records that changed while their tab was hidden. Marked rather than
  // switched to, so the plan stays in view.
  const [unseen, setUnseen] = useState<ReadonlySet<RecordTab>>(EMPTY);
  // Kept where a turn can read it. A turn outlives the render that started it,
  // so what it closed over is the tab open when they pressed send rather than
  // the one they are looking at when the plan moves.
  const showingTab = useRef(tab);
  useEffect(() => {
    showingTab.current = tab;
  }, [tab]);

  // Whether the Guest notice is due is read from storage on every render rather
  // than held here: the token it is kept against arrives in a response, not
  // through React. Putting it away only needs a render to notice.
  const [, noticeDismissed] = useReducer((dismissals: number) => dismissals + 1, 0);

  const plan = usePlanHolding();
  const route = useRoute();

  const turn = useTurn({
    conversation: current,
    onConversation: setCurrent,
    onListed: setConversations,
    onAsking: () => {
      // What the page was showing around the Conversation, superseded by this
      // turn. What the last turn left in it, the turn puts down itself.
      setRowActions(null);
      setFailure(null);
    },
    onFailure: setFailure,
    onBegan: (conversationId) => plan.opened(conversationId, null),
    onPlanRevised: (conversationId, revised, changed) => {
      plan.revised(conversationId, revised, changed);
      // The turn may have started or joined a Trip, so the list and the row
      // hear about it from the same event rather than a request later.
      noteTrip(conversationId, revised);
      mark("plan");
    },
    onProfileRevised: (learned) => {
      setProfile(learned);
      mark("traveler");
    },
  });

  useEffect(() => {
    // A reload puts them back in the Conversation they were working in.
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
      // Put down either way: a failed read has already said so in `failure`,
      // and a pane loading forever beneath that sentence says it twice.
      .finally(() => setResuming(false));
  }, []);

  useEffect(() => {
    // Whatever the screen they are leaving was saying, the move supersedes.
    setFailure(null);
  }, [route]);

  useEffect(() => {
    if (route !== "instructions") {
      // Put down rather than kept: the composed prompt carries the plan and
      // profile as they stood, so yesterday's is not what the next message sends.
      setInstructions(null);
      return;
    }
    // A traveler arriving at this address has two reads in flight — one before
    // `resume` has said which Conversation they were in, one after — and the
    // first answering last would leave a prompt on screen that is not theirs.
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
    // Read again when the Conversation under it changes: on a reload the page
    // is drawn before `resume` has said which one they were in, and a prompt
    // composed without its plan is not what their next message sends.
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
   * Call a Conversation something the traveler will recognise it by. What the
   * server stored is what both places showing a name are then given.
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
   * The list once some Conversations have gone, and the traveler put somewhere
   * if they were reading one: the next one down, or a blank Conversation if
   * that was the last. Shared by deleting one and deleting a whole Trip.
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
   * Delete a Trip, and do what the traveler decided about its Conversations:
   * deleted, they leave the list as one deleted alone does; kept, they come
   * off the Trip and are listed under none.
   *
   * Which ones those are comes from what this page was showing rather than
   * from the server — the same answer, and the rows they were looking at.
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
    // The pane is showing a Trip that no longer exists, either way.
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

  function forget(factId: string) {
    setFailure(null);
    void forgetProfileFact(factId)
      .then(setProfile)
      .catch(() => setFailure("That could not be deleted from your profile."));
  }

  /**
   * Change how the advisor behaves, or put back the way it shipped. Both
   * answer with the instructions *and* the prompt they compose into, so the
   * traveler sees the server's composition rather than the page's guess at it.
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
   * Leave nothing behind. Everything on screen goes with it rather than being
   * re-read — what is left is a first visit, and the server has nothing to add.
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
   * A plan that has arrived, filed where the interface reads it from: the
   * Trips list and the row of the Conversation refining it. Both from the one
   * plan, or a row would be marked with a colour nothing explains.
   */
  function noteTrip(conversationId: string, refining: TripPlan) {
    setTrips((sofar) => withPlan(sofar, refining));
    markTrip(conversationId, refining.trip_id);
  }

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
   * wrong journey, and only the traveler can say so.
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
   * One change the traveler made to the plan themselves. Each answers with the
   * whole plan, so what comes back is what is shown, bar the field they have
   * moved on to editing since.
   */
  function byHand(changing: (tripId: string) => Promise<TripPlan>) {
    const tripId = plan.plan?.trip_id;
    if (tripId === undefined) return;
    void changing(tripId)
      .then((revised) => {
        plan.replaced(revised);
        // The Trips page shows this too, from the same answer.
        setTrips((sofar) => withPlan(sofar, revised));
      })
      .catch(() => setFailure("That change to your trip could not be saved."));
  }

  /** Save one field: a scalar by its name, an Itinerary Item by its identifier. */
  function save(field: string, value: string) {
    if (isScalar(field)) {
      const patch = asPatch(field, value);
      // Text the field could not hold is neither a change nor an instruction
      // to empty it, so there is nothing to send.
      if (Object.keys(patch).length === 0) return;
      byHand((tripId) => changePlan(tripId, patch));
      return;
    }
    // Clearing an Itinerary Item is not a request to delete it: the editor
    // opens with its text selected, so a Backspace and a click away would
    // destroy the row silently. Removing one is the control beside it.
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
            // Opening one is also the way back: they came here to find it.
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
            onDismissNotice={
              guestNoticeDue()
                ? () => {
                    dismissGuestNotice();
                    noticeDismissed();
                  }
                : null
            }
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
              // Nothing to put on a Trip until they have said something.
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
              // The strip says where and when, so the record opens on that
              // rather than on whichever tab was last looked at.
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
 * Trips and profile come with the rest rather than when a page asks, because
 * the first screen already marks each Conversation's Trip and has a tab
 * showing the profile.
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
