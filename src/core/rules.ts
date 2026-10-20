// Turns user corrections into tested rules (plan idea 3.12).
//
// Every hand-given label is kept as an Example. A rule change is checked against
// all Examples before it's kept. If a new channel or keyword rule would re-sort an
// earlier example, that example is pinned with a video rule (an exception), so
// nothing the user said before changes silently. The caller gets a report of
// what changed so the UI can tell the user.
import { classify } from "./classify";
import { normalize } from "./topics";
import type { CoachData, Example, FeedItem, Rule, Snapshot, TopicId } from "./types";

export type CorrectionScope = "video" | "channel";

export interface RuleChangeReport {
  /** Data after the change. */
  data: CoachData;
  /** The rule that was added. */
  rule: Rule;
  /** Earlier examples that would have changed and were pinned as exceptions. */
  exceptionsAdded: Example[];
  /** How many distinct past homepage videos now sort differently. */
  pastItemsChanged: number;
}

/** The user says: this item belongs to `topic` (just this video, or the whole channel). */
export function applyCorrection(
  data: CoachData,
  item: Pick<FeedItem, "videoId" | "title" | "channel">,
  topic: TopicId,
  scope: CorrectionScope,
  history: Snapshot[],
  now: string,
): RuleChangeReport {
  const example: Example = { videoId: item.videoId, title: item.title, channel: item.channel, topic, createdAt: now };
  const rule: Rule =
    scope === "channel" && item.channel
      ? { kind: "channel", channel: item.channel, topic, createdAt: now }
      : { kind: "video", videoId: item.videoId, topic, createdAt: now };

  // The user is re-labelling this video now, so its old label and video rule are replaced, not kept as an exception.
  const examples = [...data.examples.filter((e) => e.videoId !== item.videoId), example];
  const rules = data.rules.filter((r) => !(r.kind === "video" && r.videoId === item.videoId));
  return addRule({ ...data, examples, rules }, rule, history, now, data);
}

/** "Titles containing `keyword` are `topic`." Used from the options page. */
export function addKeywordRule(data: CoachData, keyword: string, topic: TopicId, history: Snapshot[], now: string): RuleChangeReport {
  return addRule(data, { kind: "keyword", keyword: keyword.trim(), topic, createdAt: now }, history, now);
}

export function removeRule(data: CoachData, rule: Rule): CoachData {
  return { ...data, rules: data.rules.filter((r) => !sameTarget(r, rule)) };
}

/** `before` is the data the user saw, for counting what changed (defaults to `data`). */
function addRule(data: CoachData, rule: Rule, history: Snapshot[], now: string, before: CoachData = data): RuleChangeReport {
  // A new rule for the same target replaces the old one.
  let rules = [...data.rules.filter((r) => !sameTarget(r, rule)), rule];
  let next: CoachData = { ...data, rules };

  // Regression check: every example must still sort as the user said.
  const broken = next.examples.filter((e) => classify(e, next).topic !== e.topic);
  const exceptionsAdded: Example[] = [];
  for (const e of broken) {
    rules = [...rules.filter((r) => !(r.kind === "video" && r.videoId === e.videoId)), { kind: "video", videoId: e.videoId, topic: e.topic, createdAt: now }];
    exceptionsAdded.push(e);
  }
  next = { ...next, rules };

  return { data: next, rule, exceptionsAdded, pastItemsChanged: countChanged(history, before, next) };
}

function sameTarget(a: Rule, b: Rule): boolean {
  if (a.kind === "video" && b.kind === "video") return a.videoId === b.videoId;
  if (a.kind === "channel" && b.kind === "channel") return normalize(a.channel) === normalize(b.channel);
  if (a.kind === "keyword" && b.kind === "keyword") return normalize(a.keyword) === normalize(b.keyword);
  return false;
}

function countChanged(history: Snapshot[], before: CoachData, after: CoachData): number {
  const seen = new Map<string, FeedItem>();
  for (const snapshot of history) for (const item of snapshot.items) seen.set(item.videoId, item);
  let changed = 0;
  for (const item of seen.values()) {
    if (classify(item, before).topic !== classify(item, after).topic) changed++;
  }
  return changed;
}

/** Every example sorts as labelled. Used by tests and as a sanity check on load. */
export function allExamplesPass(data: CoachData): boolean {
  return data.examples.every((e) => classify(e, data).topic === e.topic);
}
