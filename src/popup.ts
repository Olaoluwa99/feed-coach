// The window that opens when you click the extension icon:
// goals, progress, your homepage's topic mix, and questions about unsorted channels.
import { ACTION_LABELS, evaluateAction, summarize, type ActionResult, type ActionStatus } from "./core/actions";
import { averageShares, goalProgress, rankShares, whatToAsk } from "./core/stats";
import { allTopics, topicName, UNSORTED } from "./core/topics";
import type { GoalDirection, Topic } from "./core/types";
import { sendToBackground } from "./messages";
import { getCoach, getLastState, getSnapshots, onDataChanged } from "./storage";
import { $, el, formatDate, pct } from "./ui/dom";

const DAY_MS = 24 * 60 * 60 * 1000;

async function render(): Promise<void> {
  $("version").textContent = chrome.runtime.getManifest().version;
  const [snapshots, lastState, coach] = await Promise.all([getSnapshots(), getLastState(), getCoach()]);
  const topics = allTopics(coach);
  const now = new Date();

  $("history-off").hidden = lastState?.state !== "history-off";
  $("status").textContent =
    snapshots.length === 0
      ? "No homepage snapshots yet. Open youtube.com and wait a few seconds."
      : `${snapshots.length} homepage visit${snapshots.length === 1 ? "" : "s"} recorded since ${formatDate(snapshots[0]!.takenAt)}.`;

  // Goals: tap cycles none → more → less → none.
  $("goal-chips").replaceChildren(
    ...[...topics]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((topic) => goalChip(topic, coach.goals[topic.id]?.direction ?? null)),
  );

  // Progress
  const progress = goalProgress(snapshots, coach, now);
  $("progress-section").hidden = progress.length === 0;
  $("progress").replaceChildren(
    ...progress.map((p) => {
      const name = topicName(topics, p.topic);
      const verb = p.direction === "more" ? "More" : "Less";
      if (p.status === "too-early") {
        const start = p.before !== null ? ` Started at ${pct(p.before)}.` : "";
        return el("li", {}, `${verb} ${name}: measuring. Give it a few days of normal YouTube use.${start}`);
      }
      const verdict = { improving: "improving", "no-change": "no real change yet", worse: "going the wrong way" }[p.status];
      return el("li", { className: p.status }, `${verb} ${name}: ${pct(p.before ?? 0)} → ${pct(p.now ?? 0)} (${verdict})`);
    }),
  );

  // What worked: YouTube feedback actions (decision 0007)
  const results = coach.actions.map((a) => evaluateAction(a, snapshots));
  $("actions-section").hidden = results.length === 0;
  $("action-summary").replaceChildren(
    ...summarize(results)
      .filter((s) => s.judged + s.measuring > 0)
      .map((s) => {
        const judged = s.judged > 0 ? `worked ${s.worked} · partly ${s.partly} · didn't work ${s.didntWork}` : "no results yet";
        const measuring = s.measuring > 0 ? ` · measuring ${s.measuring}` : "";
        return el("li", {}, [el("b", {}, ACTION_LABELS[s.kind]), el("span", {}, `: ${judged}${measuring}`)]);
      }),
  );
  $("action-list").replaceChildren(
    ...[...results]
      .sort((a, b) => b.action.takenAt.localeCompare(a.action.takenAt))
      .slice(0, 5)
      .map((r) => el("li", { className: STATUS_CLASS[r.status] }, `${r.action.channel ?? r.action.title} · ${ACTION_LABELS[r.action.kind]} · ${describeResult(r)}`)),
  );

  // Topic mix, last 7 days
  const recent = snapshots.filter((s) => Date.parse(s.takenAt) >= now.getTime() - 7 * DAY_MS);
  const ranked = rankShares(averageShares(recent, coach)).slice(0, 8);
  $("mix-section").hidden = ranked.length === 0;
  $("mix").replaceChildren(
    ...ranked.map(({ topic, share }) => {
      const goal = coach.goals[topic]?.direction ?? "";
      return el("div", { className: "row" }, [
        el("span", { className: "name" }, topic === UNSORTED ? "Unsorted" : topicName(topics, topic)),
        el("span", { className: "bar" }, [el("span", { className: goal, style: `width:${Math.round(share * 100)}%` })]),
        el("span", { className: "pct" }, pct(share)),
      ]);
    }),
  );

  // The harness asks instead of guessing.
  const asks = whatToAsk(snapshots, coach, now);
  $("ask-section").hidden = asks.length === 0;
  $("ask").replaceChildren(
    ...asks.map((ask) => {
      const select = topicSelect(topics, ask.candidates);
      select.addEventListener("change", async () => {
        if (!select.value) return;
        const reply = await sendToBackground({ type: "correct", item: ask.example, topic: select.value, scope: "channel" });
        showMessage(reply.ok ? (reply.message ?? "Saved.") : reply.error, reply.ok);
      });
      return el("li", {}, [
        el("div", {}, [el("b", {}, ask.channel ?? "A video"), el("span", { className: "muted" }, ` · seen ${ask.count}×`)]),
        el("div", { className: "muted small" }, `e.g. "${ask.example.title}"`),
        select,
      ]);
    }),
  );
}

const STATUS_CLASS: Record<ActionStatus, string> = {
  worked: "improving",
  partly: "",
  "didnt-work": "worse",
  measuring: "muted",
  undone: "muted",
  "cant-check": "muted",
  "no-data": "muted",
};

function describeResult(r: ActionResult): string {
  const was = r.beforeRate === null ? "not enough earlier visits to compare" : `was in ${pct(r.beforeRate)} of visits before`;
  const now = r.afterRate === null ? "" : `in ${pct(r.afterRate)} of visits since`;
  switch (r.status) {
    case "measuring":
      return `measuring (${r.visitsAfter} later visit${r.visitsAfter === 1 ? "" : "s"} so far)`;
    case "undone":
      return "undone";
    case "cant-check":
      return "can't check: YouTube didn't show the channel name";
    case "no-data":
      return "not enough visits in the 2 weeks after to judge";
    case "worked":
      if (r.action.kind === "dont-recommend-channel") return `worked: channel gone since (${was})`;
      return r.afterRate === null ? "worked: video gone (channel unknown)" : `worked: video gone, channel ${now} (${was})`;
    case "partly":
      return r.action.kind === "dont-recommend-channel" ? `partly: channel ${now} (${was})` : `partly: video gone, but channel ${now} (${was})`;
    case "didnt-work":
      return r.videoCameBack && r.action.kind === "not-interested" ? "didn't work: the same video came back" : `didn't work: channel ${now} (${was})`;
  }
}

function goalChip(topic: Topic, direction: GoalDirection | null): HTMLElement {
  const label = direction === "more" ? `▲ ${topic.name}` : direction === "less" ? `▼ ${topic.name}` : topic.name;
  const chip = el("button", { className: `chip ${direction ?? ""}`, type: "button", title: "Tap to change" }, label);
  chip.addEventListener("click", async () => {
    const next: GoalDirection | null = direction === null ? "more" : direction === "more" ? "less" : null;
    await sendToBackground({ type: "set-goal", topic: topic.id, direction: next });
  });
  return chip;
}

function topicSelect(topics: Topic[], suggested: string[]): HTMLSelectElement {
  const first = topics.filter((t) => suggested.includes(t.id));
  const rest = topics.filter((t) => !suggested.includes(t.id)).sort((a, b) => a.name.localeCompare(b.name));
  return el("select", {}, [
    el("option", { value: "" }, "Choose a topic…"),
    ...[...first, ...rest].map((t) => el("option", { value: t.id }, t.name)),
  ]);
}

function showMessage(text: string, ok: boolean): void {
  const message = $("message");
  message.textContent = text;
  message.className = ok ? "ok" : "error";
  message.hidden = false;
}

$("open-settings").addEventListener("click", () => void chrome.runtime.openOptionsPage());
onDataChanged(() => void render());
await render();
