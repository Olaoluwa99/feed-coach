// Turns snapshots into numbers: topic shares, progress toward goals, and what to ask about.
import { classify } from "./classify";
import { allTopics, UNSORTED } from "./topics";
import type { CoachData, FeedItem, GoalDirection, Snapshot, TopicId } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A change smaller than this (in share, 0.02 = 2 percentage points) counts as "no real change". */
export const MEANINGFUL_CHANGE = 0.02;
/** Progress needs at least this many snapshots after the goal was set... */
export const MIN_SNAPSHOTS_AFTER = 3;
/** ...spread over at least this long. */
export const MIN_DAYS_AFTER = 2;

export type Shares = Record<TopicId, number>;

/** Fraction of items in each topic (0–1). */
export function topicShares(items: FeedItem[], data: CoachData): Shares {
  const shares: Shares = {};
  if (items.length === 0) return shares;
  const topics = allTopics(data);
  for (const item of items) {
    const { topic } = classify(item, data, topics);
    shares[topic] = (shares[topic] ?? 0) + 1 / items.length;
  }
  return shares;
}

/** Average of each snapshot's shares, so every visit counts equally. */
export function averageShares(snapshots: Snapshot[], data: CoachData): Shares {
  const total: Shares = {};
  if (snapshots.length === 0) return total;
  for (const snapshot of snapshots) {
    for (const [topic, share] of Object.entries(topicShares(snapshot.items, data))) {
      total[topic] = (total[topic] ?? 0) + share / snapshots.length;
    }
  }
  return total;
}

/** Topics sorted by share, largest first. */
export function rankShares(shares: Shares): { topic: TopicId; share: number }[] {
  return Object.entries(shares)
    .map(([topic, share]) => ({ topic, share }))
    .sort((a, b) => b.share - a.share);
}

export type ProgressStatus = "too-early" | "improving" | "no-change" | "worse";

export interface GoalProgress {
  topic: TopicId;
  direction: GoalDirection;
  since: string;
  /** Share before the goal (or on its first day), or null if there's no data at all. */
  before: number | null;
  /** Share over the last 7 days, or null if too early. */
  now: number | null;
  status: ProgressStatus;
  snapshotsAfter: number;
}

/**
 * Before = the 7 days before the goal was set. If there's nothing then (e.g. the goal
 * was set on install day), before = the first day of snapshots after it.
 * Now = the last 7 days, excluding whatever was used as "before".
 */
export function goalProgress(snapshots: Snapshot[], data: CoachData, now: Date): GoalProgress[] {
  return Object.entries(data.goals).map(([topic, goal]) => {
    const since = Date.parse(goal.since);
    const at = (s: Snapshot) => Date.parse(s.takenAt);

    let before = snapshots.filter((s) => at(s) < since && at(s) >= since - 7 * DAY_MS);
    let after = snapshots.filter((s) => at(s) >= since);
    if (before.length === 0 && after.length > 0) {
      const firstDayEnd = at(after[0]!) + DAY_MS;
      before = after.filter((s) => at(s) < firstDayEnd);
      after = after.filter((s) => at(s) >= firstDayEnd);
    }
    const recent = after.filter((s) => at(s) >= now.getTime() - 7 * DAY_MS);

    const beforeShare = before.length > 0 ? (averageShares(before, data)[topic] ?? 0) : null;
    // The data itself must reach MIN_DAYS_AFTER past the goal; time passing with no visits doesn't count.
    const reachDays = recent.length > 0 ? (Math.max(...recent.map(at)) - since) / DAY_MS : 0;
    const enough = beforeShare !== null && recent.length >= MIN_SNAPSHOTS_AFTER && reachDays >= MIN_DAYS_AFTER;
    const nowShare = enough ? (averageShares(recent, data)[topic] ?? 0) : null;

    let status: ProgressStatus = "too-early";
    if (nowShare !== null && beforeShare !== null) {
      const change = (nowShare - beforeShare) * (goal.direction === "more" ? 1 : -1);
      status = change >= MEANINGFUL_CHANGE ? "improving" : change <= -MEANINGFUL_CHANGE ? "worse" : "no-change";
    }

    return { topic, direction: goal.direction, since: goal.since, before: beforeShare, now: nowShare, status, snapshotsAfter: after.length };
  });
}

export interface AskItem {
  /** The channel to ask about, or null for a single video without a channel (e.g. a Short). */
  channel: string | null;
  /** One example video from it, to show the user. */
  example: FeedItem;
  /** How many times it appeared unsorted in the period. */
  count: number;
  candidates: TopicId[];
}

/**
 * The harness asks instead of guessing (plan idea 3.13): the unsorted channels that
 * showed up most in the last 7 days, so one answer fixes the most items.
 */
export function whatToAsk(snapshots: Snapshot[], data: CoachData, now: Date, limit = 5): AskItem[] {
  const recent = snapshots.filter((s) => Date.parse(s.takenAt) >= now.getTime() - 7 * DAY_MS);
  const topics = allTopics(data);
  const groups = new Map<string, AskItem>();

  for (const snapshot of recent) {
    for (const item of snapshot.items) {
      const result = classify(item, data, topics);
      if (result.topic !== UNSORTED) continue;
      const key = item.channel ? `c:${item.channel.toLowerCase()}` : `v:${item.videoId}`;
      const group = groups.get(key) ?? { channel: item.channel, example: item, count: 0, candidates: result.candidates ?? [] };
      group.count++;
      groups.set(key, group);
    }
  }

  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
