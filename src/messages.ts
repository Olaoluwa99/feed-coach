// Messages passed between the content script, popup, options page and the
// background service worker. The background worker is the only writer of
// snapshots and coach data, so concurrent edits from several tabs can't clash.
import type { CorrectionScope } from "./core/rules";
import type { FeedbackAction, FeedbackKind, FeedItem, GoalDirection, HomepageState, Rule, Snapshot, Topic, TopicId } from "./core/types";

export type Message =
  | { type: "content-ready"; url: string }
  | { type: "homepage-state"; state: HomepageState }
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "correct"; item: Pick<FeedItem, "videoId" | "title" | "channel">; topic: TopicId; scope: CorrectionScope }
  | { type: "add-keyword-rule"; keyword: string; topic: TopicId }
  // The whole rule, not its position: positions shift when other rules change.
  | { type: "remove-rule"; rule: Rule }
  | { type: "set-goal"; topic: TopicId; direction: GoalDirection | null }
  | { type: "add-topic"; topic: Omit<Topic, "id" | "custom"> }
  | { type: "remove-topic"; id: TopicId }
  | { type: "sort-with-ai" }
  | { type: "ai-off" }
  | { type: "clear-all" }
  // YouTube feedback buttons (decision 0007)
  | { type: "record-action"; kind: FeedbackKind; item: Pick<FeedItem, "videoId" | "title" | "channel">; source: FeedbackAction["source"] }
  | { type: "undo-action"; videoId: string }
  | { type: "remove-action"; id: string };

/** What the background worker sends back. */
export type Reply =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export async function sendToBackground(message: Message): Promise<Reply> {
  try {
    return ((await chrome.runtime.sendMessage(message)) as Reply | undefined) ?? { ok: true };
  } catch {
    // The extension was reloaded or updated while this page stayed open.
    return { ok: false, error: "Feed Coach was updated. Refresh this page." };
  }
}
