// Settings page: custom topics, sorting rules, optional AI, export and delete.
import { ACTION_LABELS, evaluateAction, type ActionStatus } from "./core/actions";
import { PROVIDERS } from "./core/ai";
import { allTopics, topicName } from "./core/topics";
import type { Rule } from "./core/types";
import { sendToBackground, type Message } from "./messages";
import { getAi, getCoach, getSnapshots, onDataChanged, setAi } from "./storage";
import { $, el, formatDate } from "./ui/dom";

async function render(): Promise<void> {
  const [coach, snapshots, ai] = await Promise.all([getCoach(), getSnapshots(), getAi()]);
  const topics = allTopics(coach);

  // Custom topics
  $("custom-topics").replaceChildren(
    ...coach.customTopics.map((topic) => {
      const remove = el("button", { type: "button" }, "Remove");
      remove.addEventListener("click", () => {
        if (confirm(`Remove "${topic.name}"? Its rules and goal are removed too.`)) void send({ type: "remove-topic", id: topic.id });
      });
      return el("li", {}, [el("b", {}, topic.name), el("span", { className: "muted" }, ` · ${topic.keywords.join(", ") || "no keywords"} `), remove]);
    }),
  );

  // Rules
  const keywordTopic = $<HTMLSelectElement>("keyword-topic");
  const chosen = keywordTopic.value;
  keywordTopic.replaceChildren(...[...topics].sort((a, b) => a.name.localeCompare(b.name)).map((t) => el("option", { value: t.id }, t.name)));
  if (chosen) keywordTopic.value = chosen;

  $("no-rules").hidden = coach.rules.length > 0;
  $("rules").replaceChildren(
    ...coach.rules.map((rule) => {
      const remove = el("button", { type: "button" }, "Remove");
      remove.addEventListener("click", () => {
        remove.disabled = true;
        void send({ type: "remove-rule", rule });
      });
      return el("tr", {}, [el("td", {}, describeRule(rule, coach.examples)), el("td", {}, topicName(topics, rule.topic)), el("td", {}, [remove])]);
    }),
  );

  // Tracked YouTube actions
  $("no-actions").hidden = coach.actions.length > 0;
  $("actions").replaceChildren(
    ...[...coach.actions]
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
      .map((action) => {
        const result = evaluateAction(action, snapshots);
        const remove = el("button", { type: "button" }, "Remove");
        remove.addEventListener("click", () => {
          remove.disabled = true;
          void send({ type: "remove-action", id: action.id });
        });
        return el("tr", {}, [
          el("td", {}, formatDate(action.takenAt)),
          el("td", {}, [el("div", {}, action.title), el("div", { className: "muted small" }, action.channel ?? "")]),
          el("td", {}, `${ACTION_LABELS[action.kind]}${action.source === "manual" ? " (told by you)" : ""}`),
          el("td", {}, RESULT_TEXT[result.status]),
          el("td", {}, [remove]),
        ]);
      }),
  );

  // AI
  $("ai-status").textContent = ai?.enabled
    ? `On: ${ai.model} at ${new URL(ai.endpoint).hostname}. ${Object.keys(coach.aiCache).length} videos sorted by AI so far.`
    : "Off.";
  const provider = $<HTMLSelectElement>("ai-provider");
  if (provider.options.length === 0) {
    provider.replaceChildren(...PROVIDERS.map((p, i) => el("option", { value: String(i) }, p.name)));
    const known = PROVIDERS.findIndex((p) => ai && new URL(p.endpoint).origin === new URL(ai.endpoint).origin);
    provider.value = String(Math.max(known, 0));
    $<HTMLInputElement>("ai-endpoint").value = ai?.endpoint ?? PROVIDERS[0].endpoint;
    $<HTMLInputElement>("ai-model").value = ai?.model ?? PROVIDERS[0].model;
    $<HTMLInputElement>("ai-key").value = ai?.apiKey ?? "";
  }
  $<HTMLButtonElement>("ai-run").disabled = !ai?.enabled;

  // Data
  $("data-summary").textContent =
    snapshots.length === 0
      ? "No homepage snapshots yet."
      : `${snapshots.length} homepage snapshots from ${formatDate(snapshots[0]!.takenAt)} to ${formatDate(snapshots.at(-1)!.takenAt)}, ${coach.rules.length} rules, ${Object.keys(coach.goals).length} goals.`;
}

const RESULT_TEXT: Record<ActionStatus, string> = {
  measuring: "Measuring",
  worked: "Worked",
  partly: "Partly worked",
  "didnt-work": "Didn't work",
  undone: "Undone",
  "cant-check": "Can't check (no channel name)",
  "no-data": "Not enough visits to judge",
};

function describeRule(rule: Rule, examples: { videoId: string; title: string }[]): string {
  if (rule.kind === "channel") return `Channel: ${rule.channel}`;
  if (rule.kind === "keyword") return `Titles containing "${rule.keyword}"`;
  const title = examples.find((e) => e.videoId === rule.videoId)?.title;
  return title ? `Video: ${title}` : `Video ${rule.videoId}`;
}

async function send(message: Message): Promise<void> {
  const reply = await sendToBackground(message);
  showMessage(reply.ok ? (reply.message ?? "Saved.") : reply.error, reply.ok);
}

function showMessage(text: string, ok: boolean): void {
  const message = $("message");
  message.textContent = text;
  message.className = ok ? "ok" : "error";
  message.hidden = false;
}

$("add-topic").addEventListener("click", async () => {
  const name = $<HTMLInputElement>("topic-name");
  const keywords = $<HTMLInputElement>("topic-keywords");
  await send({ type: "add-topic", topic: { name: name.value, keywords: keywords.value.split(",") } });
  name.value = "";
  keywords.value = "";
});

$("add-keyword").addEventListener("click", async () => {
  const keyword = $<HTMLInputElement>("keyword");
  await send({ type: "add-keyword-rule", keyword: keyword.value, topic: $<HTMLSelectElement>("keyword-topic").value });
  keyword.value = "";
});

$("ai-provider").addEventListener("change", () => {
  const preset = PROVIDERS[Number($<HTMLSelectElement>("ai-provider").value)];
  if (!preset) return;
  $<HTMLInputElement>("ai-endpoint").value = preset.endpoint;
  $<HTMLInputElement>("ai-model").value = preset.model;
});

$("ai-save").addEventListener("click", async () => {
  const endpoint = $<HTMLInputElement>("ai-endpoint").value.trim();
  const model = $<HTMLInputElement>("ai-model").value.trim();
  const apiKey = $<HTMLInputElement>("ai-key").value.trim();
  // Only the providers listed in the manifest's optional_host_permissions can be used.
  let origin: string;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || !PROVIDERS.some((p) => new URL(p.endpoint).origin === url.origin)) throw new Error();
    origin = `${url.origin}/*`;
  } catch {
    return showMessage(`The endpoint must be on one of: ${PROVIDERS.map((p) => new URL(p.endpoint).hostname).join(", ")}.`, false);
  }
  if (!model || !apiKey) return showMessage("Fill in the model and your API key.", false);

  // Chrome asks the user to allow Feed Coach to contact this one site.
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) return showMessage("Permission to contact the AI provider was not given, so AI stays off.", false);

  await setAi({ enabled: true, endpoint, model, apiKey });
  showMessage("AI sorting is on. New unsorted videos will be sorted after each homepage visit.", true);
  await send({ type: "sort-with-ai" });
});

$("ai-run").addEventListener("click", () => void send({ type: "sort-with-ai" }));

$("ai-off").addEventListener("click", async () => {
  const ai = await getAi();
  // Through the background worker, so an AI run in progress stops before its next batch.
  await send({ type: "ai-off" });
  if (ai) {
    try {
      await chrome.permissions.remove({ origins: [`${new URL(ai.endpoint).origin}/*`] });
    } catch {
      // Permission may already be gone.
    }
  }
  $<HTMLInputElement>("ai-key").value = "";
  await render();
});

$("export").addEventListener("click", async () => {
  const data = await chrome.storage.local.get(null);
  if (data.ai && typeof data.ai === "object") data.ai = { ...(data.ai as object), apiKey: "(removed from export)" };
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" });
  const link = el("a", { href: URL.createObjectURL(blob) });
  link.download = `feed-coach-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

$("clear").addEventListener("click", async () => {
  if (!confirm("Delete all Feed Coach data: snapshots, goals, rules, topics, tracked actions and AI settings? This can't be undone.")) return;
  // Through the background worker, so a save already in progress can't bring data back.
  const reply = await sendToBackground({ type: "clear-all" });
  if (!reply.ok) return showMessage(reply.error, false);
  // Also give back any access to AI providers that was granted.
  try {
    await chrome.permissions.remove({ origins: PROVIDERS.map((p) => `${new URL(p.endpoint).origin}/*`) });
  } catch {
    // Nothing was granted.
  }
  location.reload();
});

onDataChanged(() => void render());
await render();
