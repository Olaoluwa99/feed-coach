// Tracking YouTube's feedback buttons and judging whether they worked (decision 0007).
// Pure functions: no browser APIs, so everything here is tested directly.
import { normalize } from "./topics";
import type { ActionStatus, FeedbackAction, FeedbackKind, FeedItem, FrozenResult, Snapshot } from "./types";

export type { ActionStatus } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** An action is judged only after this many homepage visits... */
export const MIN_VISITS_AFTER = 5;
/** ...with the data reaching at least this long after the action. */
export const MIN_DAYS_AFTER = 2;
/** Visits in the first this-many days after an action are used to judge it; then the result is frozen. */
export const JUDGE_WINDOW_DAYS = 14;
/** "Halved" comparisons need at least this many earlier visits (besides the action's own). */
export const MIN_BEFORE_VISITS = 3;
/** A snapshot this close to the action is the same homepage visit, not a later one. */
export const SAME_VISIT_MS = 5 * 60 * 1000;
/** "Undo" clicked within this long after an action cancels it. */
export const UNDO_WINDOW_MS = 2 * 60 * 1000;
/** The same detected action on the same video within this long is a duplicate. */
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
export const MAX_ACTIONS = 500;
/** Personal tips need at least this many judged actions of a kind. */
export const MIN_JUDGED_FOR_TIP = 3;

export const ACTION_LABELS: Record<FeedbackKind, string> = {
  "dont-recommend-channel": "Don't recommend channel",
  "not-interested": "Not interested",
};

// YouTube's menu labels, normalized (lowercase, no accents or punctuation).
// English first; a few common languages so detection isn't English-only.
const MENU_LABELS: Record<FeedbackKind, string[]> = {
  "dont-recommend-channel": [
    "don t recommend channel",
    "do not recommend channel",
    "ne pas recommander la chaine",
    "no recomendar canal",
    "no recomendar el canal",
    "nao recomendar o canal",
    "nao recomendar canal",
    "kanal nicht empfehlen",
    "non consigliare il canale",
  ],
  "not-interested": ["not interested", "pas interesse", "ca ne m interesse pas", "no me interesa", "nao tenho interesse", "kein interesse", "non mi interessa"],
};

const UNDO_LABELS = ["undo", "annuler", "deshacer", "desfazer", "ruckgangig machen", "rueckgaengig machen", "annulla"];

/** Which feedback button a menu item is, from its visible label. */
export function matchMenuLabel(label: string): FeedbackKind | null {
  const text = normalize(label);
  if (!text) return null;
  for (const kind of Object.keys(MENU_LABELS) as FeedbackKind[]) {
    if (MENU_LABELS[kind].includes(text)) return kind;
  }
  return null;
}

export function isUndoLabel(label: string): boolean {
  return UNDO_LABELS.includes(normalize(label));
}

// ---------- Snapshots, prepared once ----------

interface PreparedVisit {
  time: number;
  channels: Set<string>;
  videos: Set<string>;
}

// Evaluating many actions against many snapshots is the hot path; each snapshot list
// is turned into sets once. Snapshot arrays are replaced (never mutated) on change.
const prepared = new WeakMap<Snapshot[], PreparedVisit[]>();

function prepare(snapshots: Snapshot[]): PreparedVisit[] {
  let visits = prepared.get(snapshots);
  if (!visits) {
    visits = snapshots.map((s) => ({
      time: Date.parse(s.takenAt),
      channels: new Set(s.items.flatMap((i) => (i.channel ? [normalize(i.channel)] : []))),
      videos: new Set(s.items.map((i) => i.videoId)),
    }));
    prepared.set(snapshots, visits);
  }
  return visits;
}

// ---------- Recording ----------

/**
 * How often the channel showed up in the 7 days before the action. The visit the
 * action happened on always counts as one visit showing the channel.
 */
export function computeBaseline(channel: string | null, takenAt: string, snapshots: Snapshot[]): NonNullable<FeedbackAction["baseline"]> {
  const at = Date.parse(takenAt);
  const name = channel ? normalize(channel) : null;
  const earlier = prepare(snapshots).filter((v) => v.time < at - SAME_VISIT_MS && v.time >= at - 7 * DAY_MS);
  return {
    visits: earlier.length + 1,
    channelVisits: (name ? earlier.filter((v) => v.channels.has(name)).length : 0) + 1,
  };
}

export function makeAction(
  kind: FeedbackKind,
  item: Pick<FeedItem, "videoId" | "title" | "channel">,
  takenAt: string,
  source: FeedbackAction["source"],
  snapshots: Snapshot[] = [],
): FeedbackAction {
  return {
    id: `${kind}:${item.videoId}:${takenAt}`,
    kind,
    videoId: item.videoId,
    title: item.title,
    channel: item.channel,
    takenAt,
    source,
    baseline: computeBaseline(item.channel, takenAt, snapshots),
  };
}

/**
 * Adds an action, or returns null if it's a duplicate: the same detected action on the
 * same video within 10 minutes, or a hand report of an action already recorded.
 */
export function addAction(actions: FeedbackAction[], action: FeedbackAction): FeedbackAction[] | null {
  const at = Date.parse(action.takenAt);
  const duplicate = actions.some(
    (a) =>
      a.kind === action.kind &&
      a.videoId === action.videoId &&
      !a.undone &&
      (action.source === "manual" || Math.abs(Date.parse(a.takenAt) - at) < DUPLICATE_WINDOW_MS),
  );
  if (duplicate) return null;
  return [...actions, action].slice(-MAX_ACTIONS);
}

/** Marks the latest action on this video as undone, if it's within the undo window. Returns null if there's nothing to undo. */
export function undoLatest(actions: FeedbackAction[], now: string, videoId: string): FeedbackAction[] | null {
  const t = Date.parse(now);
  let latest = -1;
  actions.forEach((a, i) => {
    const age = t - Date.parse(a.takenAt);
    if (a.videoId !== videoId || a.undone || age < 0 || age > UNDO_WINDOW_MS) return;
    if (latest === -1 || Date.parse(a.takenAt) >= Date.parse(actions[latest]!.takenAt)) latest = i;
  });
  if (latest === -1) return null;
  return actions.map((a, i) => (i === latest ? { ...a, undone: true } : a));
}

// ---------- Judging ----------

export interface ActionResult extends FrozenResult {
  action: FeedbackAction;
  /** True when there were too few earlier visits to compare against. */
  noBaseline: boolean;
}

export function evaluateAction(action: FeedbackAction, snapshots: Snapshot[]): ActionResult {
  const baseline = action.baseline ?? computeBaseline(action.channel, action.takenAt, snapshots);
  const noBaseline = baseline.visits - 1 < MIN_BEFORE_VISITS;
  const beforeRate = noBaseline ? null : baseline.channelVisits / baseline.visits;

  if (action.final) return { ...action.final, action, noBaseline };

  const at = Date.parse(action.takenAt);
  const after = prepare(snapshots).filter((v) => v.time > at + SAME_VISIT_MS && v.time <= at + JUDGE_WINDOW_DAYS * DAY_MS);
  const channel = action.channel ? normalize(action.channel) : null;
  const videoCameBack = after.some((v) => v.videos.has(action.videoId));
  const base = { action, noBaseline, beforeRate, visitsAfter: after.length, videoCameBack };

  if (action.undone) return { ...base, status: "undone", afterRate: null };
  // Without a channel name (e.g. some Shorts) "Don't recommend channel" can't be checked.
  if (channel === null && action.kind === "dont-recommend-channel") return { ...base, status: "cant-check", afterRate: null };

  const reachDays = after.length > 0 ? (Math.max(...after.map((v) => v.time)) - at) / DAY_MS : 0;
  if (after.length < MIN_VISITS_AFTER || reachDays < MIN_DAYS_AFTER) return { ...base, status: "measuring", afterRate: null };

  const afterRate = channel === null ? null : after.filter((v) => v.channels.has(channel)).length / after.length;
  const halved = afterRate !== null && beforeRate !== null && afterRate <= beforeRate / 2;

  let status: ActionStatus;
  if (action.kind === "dont-recommend-channel") {
    status = afterRate === 0 ? "worked" : halved ? "partly" : "didnt-work";
  } else if (videoCameBack) {
    status = "didnt-work";
  } else {
    // The video is gone. Did the channel show up less too? (Unknown channel: judge by the video alone.)
    status = afterRate === null || afterRate === 0 || halved ? "worked" : "partly";
  }
  return { ...base, status, afterRate };
}

/**
 * Freezes an action's verdict once its judging window has closed, so it can't drift
 * later (e.g. when old snapshots are trimmed). Returns the updated action, or null if unchanged.
 */
export function finalizeAction(action: FeedbackAction, snapshots: Snapshot[], now: string): FeedbackAction | null {
  if (action.final || Date.parse(now) <= Date.parse(action.takenAt) + JUDGE_WINDOW_DAYS * DAY_MS) return null;
  const r = evaluateAction(action, snapshots);
  const status: ActionStatus = r.status === "measuring" ? "no-data" : r.status;
  return {
    ...action,
    baseline: action.baseline ?? computeBaseline(action.channel, action.takenAt, snapshots),
    final: { status, beforeRate: r.beforeRate, afterRate: r.afterRate, visitsAfter: r.visitsAfter, videoCameBack: r.videoCameBack },
  };
}

export interface ActionSummary {
  kind: FeedbackKind;
  worked: number;
  partly: number;
  didntWork: number;
  measuring: number;
  judged: number;
}

export function summarize(results: ActionResult[]): ActionSummary[] {
  return (Object.keys(ACTION_LABELS) as FeedbackKind[]).map((kind) => {
    const mine = results.filter((r) => r.action.kind === kind);
    const count = (status: ActionStatus) => mine.filter((r) => r.status === status).length;
    const worked = count("worked");
    const partly = count("partly");
    const didntWork = count("didnt-work");
    return { kind, worked, partly, didntWork, measuring: count("measuring"), judged: worked + partly + didntWork };
  });
}

/**
 * The tip shown on videos in a "less" topic. Uses the user's own results once
 * there are enough; otherwise the general advice (Mozilla 2022: "Don't recommend
 * channel" was the strongest button on average).
 */
export function lessTip(summaries: ActionSummary[]): string {
  const scored = summaries
    .filter((s) => s.judged >= MIN_JUDGED_FOR_TIP)
    .map((s) => ({ s, score: (s.worked + s.partly / 2) / s.judged }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return "Less of this: ⋮ menu → Don't recommend channel";
  return `Less of this: ⋮ menu → ${ACTION_LABELS[best.s.kind]} (worked ${best.s.worked} of ${best.s.judged} times for you)`;
}
