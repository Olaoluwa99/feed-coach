// Runs inside YouTube pages. On the homepage it:
//   1. waits for the recommendations to load and sends a snapshot to be saved
//   2. labels each video with its topic and shows the Feed Coach panel
//   3. notices when you use YouTube's "Not interested" / "Don't recommend channel"
import { evaluateAction, lessTip, summarize } from "./core/actions";
import { classify } from "./core/classify";
import { goalProgress, topicShares, type GoalProgress } from "./core/stats";
import { allTopics, UNSORTED } from "./core/topics";
import type { CoachData, GoalDirection, Snapshot, TopicId } from "./core/types";
import { sendToBackground } from "./messages";
import { getCoach, getSnapshots, getUi, onDataChanged, setUi, type UiPrefs } from "./storage";
import { removeAllLabels, removePanel, renderCardLabel, renderPanel, showToast, type Handlers } from "./ui/overlay";
import { watchFeedbackClicks } from "./youtube/feedback";
import { homepageState, homeRoot, isHomepage, readCards, readHomepage } from "./youtube/homepage";

const POLL_MS = 500;
const GIVE_UP_MS = 15_000;
/** Treat the page as settled once this many items are showing and the count stops changing. */
const MIN_ITEMS = 8;
/** The panel's numbers use the same number of items as a snapshot. */
const PANEL_ITEMS = 40;

// ---------- Snapshots ----------

let runId = 0;

async function captureHomepage(): Promise<void> {
  if (!isHomepage(new URL(location.href))) return;
  const myRun = ++runId;
  const started = Date.now();
  let lastCount = -1;

  while (Date.now() - started < GIVE_UP_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    if (myRun !== runId || !isHomepage(new URL(location.href))) return; // navigated away

    const root = homeRoot(document);
    if (!root) continue;
    const state = homepageState(root);
    if (state === "history-off") {
      void sendToBackground({ type: "homepage-state", state });
      return;
    }
    if (state !== "ready") continue;

    const count = root.querySelectorAll("ytd-rich-item-renderer").length;
    if (count >= MIN_ITEMS && count === lastCount) break;
    lastCount = count;
  }

  const root = homeRoot(document);
  const { items, adsSkipped } = root ? readHomepage(root) : { items: [], adsSkipped: 0 };
  const snapshot: Snapshot = { takenAt: new Date().toISOString(), items, adsSkipped };
  void sendToBackground({ type: "homepage-state", state: items.length > 0 ? "ready" : "loading" });
  if (items.length > 0) await sendToBackground({ type: "snapshot", snapshot });
  scheduleRender();
}

// ---------- Labels and panel ----------

let coach: CoachData | null = null;
let ui: UiPrefs | null = null;
// These only change when stored data changes, so they're computed here, not on every render.
let progress: GoalProgress[] = [];
let tipForLess = lessTip([]);
let actionsLine: string | null = null;

async function loadData(): Promise<void> {
  const [loadedCoach, loadedUi, snapshots] = await Promise.all([getCoach(), getUi(), getSnapshots()]);
  coach = loadedCoach;
  ui = loadedUi;
  progress = goalProgress(snapshots, loadedCoach, new Date());

  const results = loadedCoach.actions.map((a) => evaluateAction(a, snapshots));
  const summaries = summarize(results);
  tipForLess = lessTip(summaries);
  const tracked = results.filter((r) => r.status !== "undone").length;
  const worked = summaries.reduce((n, s) => n + s.worked, 0);
  const judged = summaries.reduce((n, s) => n + s.judged, 0);
  actionsLine =
    tracked === 0 ? null : `YouTube actions tracked: ${tracked}${judged > 0 ? ` · worked ${worked} of ${judged} judged so far` : " · still measuring"}`;
}

const handlers: Handlers = {
  async correct(item, topic, scope) {
    const reply = await sendToBackground({ type: "correct", item, topic, scope });
    const text = reply.ok ? (reply.message ?? "Saved.") : reply.error;
    showToast(text);
    return text;
  },
  async reportAction(item, kind) {
    const reply = await sendToBackground({ type: "record-action", kind, item, source: "manual" });
    const text = reply.ok ? (reply.message ?? "Saved.") : reply.error;
    showToast(text);
    return text;
  },
  setPanelCollapsed(collapsed) {
    if (ui) void setUi({ ...ui, panelCollapsed: collapsed });
  },
  setMarkersHidden(hidden) {
    if (ui) void setUi({ ...ui, markersHidden: hidden });
  },
};

function render(): void {
  const root = homeRoot(document);
  if (!isHomepage(new URL(location.href)) || !root || !coach || !ui) {
    removePanel();
    return;
  }

  const topics = allTopics(coach);
  const goals: Record<TopicId, GoalDirection> = Object.fromEntries(Object.entries(coach.goals).map(([t, g]) => [t, g.direction]));
  const { cards } = readCards(root);

  if (ui.markersHidden) {
    removeAllLabels(root);
  } else {
    for (const { element, item } of cards) {
      const classification = classify(item, coach, topics);
      renderCardLabel(element, { item, classification, goal: goals[classification.topic] ?? null, lessTip: tipForLess }, topics, handlers);
    }
  }

  const panelItems = cards.slice(0, PANEL_ITEMS).map((c) => c.item);
  const shares = topicShares(panelItems, coach);
  renderPanel(
    {
      shares,
      itemCount: panelItems.length,
      unsortedCount: Math.round((shares[UNSORTED] ?? 0) * panelItems.length),
      progress,
      goals,
      collapsed: ui.panelCollapsed,
      markersHidden: ui.markersHidden,
      topics,
      actionsLine,
    },
    handlers,
  );
}

// Throttle, not debounce: YouTube mutates the page almost constantly (previews,
// counters), so waiting for quiet could postpone rendering forever.
let renderTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleRender(): void {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = undefined;
    render();
  }, 300);
}

const CARD = "ytd-rich-item-renderer";

/**
 * Only changes to video cards matter: a card being added, or a card without our
 * label filling in its content (YouTube adds cards first and their titles after).
 * Everything else YouTube changes (previews, counters, menus) is ignored.
 */
function affectsCards(mutations: MutationRecord[]): boolean {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof Element && (node.matches(CARD) || node.querySelector(CARD))) return true;
    }
    const target = mutation.target instanceof Element ? mutation.target : null;
    const card = target?.closest(CARD);
    if (card && !card.querySelector(":scope > [data-feed-coach]")) return true;
  }
  return false;
}

const observer = new MutationObserver((mutations) => {
  if (isHomepage(new URL(location.href)) && affectsCards(mutations)) scheduleRender();
});

async function start(): Promise<void> {
  void sendToBackground({ type: "content-ready", url: location.href });
  await loadData();
  onDataChanged(() => void loadData().then(scheduleRender));
  observer.observe(document.body, { childList: true, subtree: true });

  // Notice YouTube feedback clicks on homepage videos (we only watch; we never click).
  watchFeedbackClicks(
    (card) => isHomepage(new URL(location.href)) && card.closest("ytd-browse[page-subtype='home']") !== null,
    {
      onAction(kind, item) {
        void sendToBackground({ type: "record-action", kind, item, source: "detected" }).then((reply) => showToast(reply.ok ? (reply.message ?? "") : reply.error));
      },
      onUndo(videoId) {
        void sendToBackground({ type: "undo-action", videoId }).then((reply) => {
          if (reply.ok && reply.message) showToast(reply.message);
        });
      },
    },
  );

  void captureHomepage();
  scheduleRender();

  // YouTube is a single-page app: moving between pages doesn't reload this script.
  document.addEventListener("yt-navigate-finish", () => {
    void captureHomepage();
    scheduleRender();
  });
}

void start();
