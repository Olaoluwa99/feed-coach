// Background service worker: the single writer of snapshots and coach data.
// Receives messages from YouTube tabs, the popup and the options page.
import { ACTION_LABELS, addAction, finalizeAction, makeAction, undoLatest } from "./core/actions";
import { BATCH_SIZE, sortBatch } from "./core/ai";
import { classify } from "./core/classify";
import { addKeywordRule, applyCorrection, removeRule, type RuleChangeReport } from "./core/rules";
import { addSnapshot } from "./core/snapshots";
import { allTopics, makeTopicId, normalize, UNSORTED } from "./core/topics";
import type { FeedItem, Rule, TopicId } from "./core/types";
import type { Message, Reply } from "./messages";
import { clearAll, getAi, getCoach, getSnapshots, setAi, setCoach, setLastState, setSnapshots } from "./storage";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Most titles sent to the AI in one run, to stay inside free-tier limits. */
const AI_MAX_PER_RUN = 100;

// Messages can arrive from several tabs at once. Running storage writes one after
// another keeps a read-modify-write from overwriting another. Only quick storage
// work goes through here; slow network calls (AI) run outside it.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (message.type === "content-ready") {
    const tabId = sender.tab?.id;
    if (tabId !== undefined) {
      chrome.action.setBadgeText({ tabId, text: "ON" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#2e7d32" });
    }
    sendResponse({ ok: true } satisfies Reply);
    return false;
  }

  const work = message.type === "sort-with-ai" ? sortRecentWithAi() : serial(() => handle(message));
  work
    .then(sendResponse)
    .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) } satisfies Reply));
  return true; // reply comes asynchronously
});

async function handle(message: Message): Promise<Reply> {
  const now = new Date().toISOString();

  switch (message.type) {
    case "content-ready":
    case "sort-with-ai":
      return { ok: true }; // handled before the queue

    case "homepage-state":
      await setLastState(message.state);
      return { ok: true };

    case "snapshot": {
      const updated = addSnapshot(await getSnapshots(), message.snapshot);
      if (!updated) return { ok: true };
      await setSnapshots(updated);

      // Freeze verdicts of actions whose judging window has closed, before old snapshots get trimmed.
      const coach = await getCoach();
      let changed = false;
      const actions = coach.actions.map((a) => {
        const frozen = finalizeAction(a, updated, now);
        if (frozen) changed = true;
        return frozen ?? a;
      });
      if (changed) await setCoach({ ...coach, actions });

      // Sort new unsorted titles if the user turned AI on. Not awaited: it's slow.
      void sortWithAi(message.snapshot.items).catch(() => undefined);
      return { ok: true };
    }

    case "correct": {
      const report = applyCorrection(await getCoach(), message.item, message.topic, message.scope, await getSnapshots(), now);
      await setCoach(report.data);
      return { ok: true, message: describe(report) };
    }

    case "add-keyword-rule": {
      if (!normalize(message.keyword)) return { ok: false, error: "Type a word or phrase (letters or numbers) first." };
      const report = addKeywordRule(await getCoach(), message.keyword, message.topic, await getSnapshots(), now);
      await setCoach(report.data);
      return { ok: true, message: describe(report) };
    }

    case "remove-rule": {
      const coach = await getCoach();
      if (!coach.rules.some((r) => sameRule(r, message.rule))) return { ok: false, error: "That rule was already changed or removed." };
      // Labels that only this rule kept correct are dropped too, so the rest still pass.
      const without = removeRule(coach, message.rule);
      const examples = without.examples.filter((e) => classify(e, without).topic === e.topic);
      await setCoach({ ...without, examples });
      const dropped = without.examples.length - examples.length;
      return { ok: true, message: dropped > 0 ? `Removed. ${dropped} label${dropped === 1 ? "" : "s"} that relied on it ${dropped === 1 ? "was" : "were"} removed too.` : "Removed." };
    }

    case "set-goal": {
      const coach = await getCoach();
      const goals = { ...coach.goals };
      if (message.direction === null) delete goals[message.topic];
      else if (goals[message.topic]?.direction !== message.direction) goals[message.topic] = { direction: message.direction, since: now };
      await setCoach({ ...coach, goals });
      return { ok: true };
    }

    case "add-topic": {
      const coach = await getCoach();
      const name = message.topic.name.trim();
      if (!name) return { ok: false, error: "Give the topic a name." };
      const topics = allTopics(coach);
      if (topics.some((t) => t.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: `"${name}" already exists.` };
      const keywords = message.topic.keywords.map((k) => k.trim().toLowerCase()).filter((k) => normalize(k));
      const topic = { id: makeTopicId(name, topics), name, keywords, custom: true };
      await setCoach({ ...coach, customTopics: [...coach.customTopics, topic] });
      return { ok: true, message: `Added "${name}".` };
    }

    case "remove-topic": {
      const coach = await getCoach();
      const goals = { ...coach.goals };
      delete goals[message.id];
      await setCoach({
        ...coach,
        customTopics: coach.customTopics.filter((t) => t.id !== message.id),
        rules: coach.rules.filter((r) => r.topic !== message.id),
        examples: coach.examples.filter((e) => e.topic !== message.id),
        goals,
      });
      return { ok: true };
    }

    case "record-action": {
      const coach = await getCoach();
      const actions = addAction(coach.actions, makeAction(message.kind, message.item, now, message.source, await getSnapshots()));
      if (!actions) return { ok: true, message: "Already noted." };
      await setCoach({ ...coach, actions });
      return { ok: true, message: `Noted: "${ACTION_LABELS[message.kind]}". Feed Coach will check over the next few days whether it worked.` };
    }

    case "undo-action": {
      const coach = await getCoach();
      const actions = undoLatest(coach.actions, now, message.videoId);
      if (!actions) return { ok: true };
      await setCoach({ ...coach, actions });
      return { ok: true, message: "Undone: Feed Coach won't count that action." };
    }

    case "remove-action": {
      const coach = await getCoach();
      await setCoach({ ...coach, actions: coach.actions.filter((a) => a.id !== message.id) });
      return { ok: true, message: "Removed." };
    }

    case "ai-off":
      await setAi(null);
      return { ok: true, message: "AI sorting is off and your key was removed." };

    case "clear-all":
      await clearAll();
      return { ok: true, message: "Everything was deleted." };
  }
}

function sameRule(a: Rule, b: Rule): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function describe(report: RuleChangeReport): string {
  const parts = ["Saved."];
  if (report.pastItemsChanged > 0) parts.push(`${report.pastItemsChanged} past video${report.pastItemsChanged === 1 ? "" : "s"} re-sorted.`);
  if (report.exceptionsAdded.length > 0) {
    const n = report.exceptionsAdded.length;
    parts.push(`${n} earlier label${n === 1 ? "" : "s"} kept as ${n === 1 ? "an exception" : "exceptions"}.`);
  }
  return parts.join(" ");
}

async function sortRecentWithAi(): Promise<Reply> {
  const snapshots = await getSnapshots();
  const recent = snapshots.filter((s) => Date.parse(s.takenAt) >= Date.now() - 7 * DAY_MS).flatMap((s) => s.items);
  const sorted = await sortWithAi(recent);
  if (sorted === null) return { ok: true, message: "AI sorting is off." };
  return { ok: true, message: `AI sorted ${sorted} video${sorted === 1 ? "" : "s"}.` };
}

/**
 * Sends still-unsorted titles to the user's AI, one batch at a time, saving after
 * each batch. Network calls run outside the save queue so corrections never wait on them.
 * Returns how many got a real topic, or null if AI is off.
 */
async function sortWithAi(items: FeedItem[]): Promise<number | null> {
  const settings = await getAi();
  if (!settings?.enabled || !settings.apiKey) return null;

  const coach = await getCoach();
  const topics = allTopics(coach);
  const pending = new Map<string, string>();
  for (const item of items) {
    if (pending.size >= AI_MAX_PER_RUN) break;
    if (item.videoId in coach.aiCache || pending.has(item.videoId)) continue;
    if (classify(item, coach, topics).topic === UNSORTED) pending.set(item.videoId, item.title);
  }

  const ids = [...pending.keys()];
  let sorted = 0;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    // Stop if the user turned AI off or deleted everything meanwhile.
    const current = await getAi();
    if (!current?.enabled || current.apiKey !== settings.apiKey) break;

    const batch = ids.slice(i, i + BATCH_SIZE);
    const answers = await sortBatch(settings, batch.map((id) => pending.get(id)!), topics);
    if (answers.size === 0) continue; // unreadable reply: try these titles another time

    // Titles the AI skipped or couldn't place are remembered as unsorted, so they aren't sent again.
    const found: Record<string, TopicId> = {};
    batch.forEach((id, index) => (found[id] = answers.get(index) ?? UNSORTED));
    sorted += Object.values(found).filter((t) => t !== UNSORTED).length;

    await serial(async () => {
      if (!(await getAi())?.enabled) return;
      const latest = await getCoach();
      await setCoach({ ...latest, aiCache: { ...latest.aiCache, ...found } });
    });
  }
  return sorted;
}
