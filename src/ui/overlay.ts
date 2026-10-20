// What Feed Coach draws on the YouTube homepage:
//   - a label on each video card showing its topic (click it to correct it)
//   - a small panel with the page's topic mix and progress toward your goals
// Everything lives in shadow DOM so YouTube's styles and ours can't interfere.
//
// YouTube enforces Trusted Types, which blocks assigning HTML strings (innerHTML).
// So every element here is built with createElement/textContent.
import type { CorrectionScope } from "../core/rules";
import type { GoalProgress, Shares } from "../core/stats";
import { topicName, UNSORTED } from "../core/topics";
import { ACTION_LABELS } from "../core/actions";
import type { Classification, FeedbackKind, FeedItem, GoalDirection, Topic, TopicId } from "../core/types";

const HOST_ATTR = "data-feed-coach";

const BASE_CSS = `
  :host { all: initial; font: 12px/1.4 Roboto, Arial, sans-serif; color-scheme: light dark;
    --fc-bg: #ffffff; --fc-text: #0f0f0f; --fc-muted: #606060; --fc-line: #e5e5e5;
    --fc-less: #c62828; --fc-less-bg: #fdecea; --fc-more: #2e7d32; --fc-more-bg: #e8f5e9;
    --fc-neutral-bg: #f2f2f2; --fc-shadow: 0 4px 16px rgba(0,0,0,.18); }
  :host-context(html[dark]) { --fc-bg: #212121; --fc-text: #f1f1f1; --fc-muted: #aaaaaa; --fc-line: #3f3f3f;
    --fc-less: #ff8a80; --fc-less-bg: #3b1f1f; --fc-more: #81c784; --fc-more-bg: #1e3321; --fc-neutral-bg: #333333; }
  button { font: inherit; cursor: pointer; }
`;

const LABEL_CSS = `${BASE_CSS}
  .chip { display: inline-block; padding: 2px 8px; border-radius: 10px; border: 1px solid transparent;
    background: var(--fc-neutral-bg); color: var(--fc-text); font-size: 11px; opacity: .92; max-width: 220px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chip.less { background: var(--fc-less-bg); color: var(--fc-less); border-color: var(--fc-less); }
  .chip.more { background: var(--fc-more-bg); color: var(--fc-more); border-color: var(--fc-more); }
  .chip.unsorted { border: 1px dashed var(--fc-muted); color: var(--fc-muted); }
  .tip { margin-top: 3px; padding: 2px 6px; border-radius: 6px; background: var(--fc-bg); color: var(--fc-text);
    font-size: 11px; box-shadow: var(--fc-shadow); max-width: 230px; }
  .menu { position: absolute; top: 24px; left: 0; width: 230px; max-height: 300px; overflow: auto; padding: 8px;
    border-radius: 8px; background: var(--fc-bg); color: var(--fc-text); box-shadow: var(--fc-shadow); }
  .menu[hidden] { display: none; }
  .menu p { margin: 0 0 6px; color: var(--fc-muted); }
  .menu label { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
  .options { display: flex; flex-wrap: wrap; gap: 4px; }
  .options button { padding: 2px 8px; border-radius: 10px; border: 1px solid var(--fc-line); background: transparent; color: var(--fc-text); }
  .options button.current { border-color: var(--fc-text); }
  .options button.suggested { border-style: dashed; border-color: var(--fc-more); }
  .status { margin-top: 6px; color: var(--fc-muted); }
  .told { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--fc-line); }
  .told p { margin-bottom: 4px; }
`;

const PANEL_CSS = `${BASE_CSS}
  .panel { width: 280px; padding: 12px; border-radius: 12px; border: 1px solid var(--fc-line);
    background: var(--fc-bg); color: var(--fc-text); box-shadow: var(--fc-shadow); }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  h2 { font-size: 13px; margin: 0; }
  p { margin: 6px 0 0; }
  .icon { border: 0; background: transparent; color: var(--fc-muted); font-size: 14px; padding: 0 4px; }
  .muted { color: var(--fc-muted); }
  .row { display: grid; grid-template-columns: 110px 1fr 34px; gap: 6px; align-items: center; margin: 3px 0; }
  .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar { height: 6px; border-radius: 3px; background: var(--fc-neutral-bg); overflow: hidden; }
  .fill { display: block; height: 100%; background: var(--fc-muted); }
  .fill.less { background: var(--fc-less); }
  .fill.more { background: var(--fc-more); }
  .mark.less { color: var(--fc-less); }
  .mark.more { color: var(--fc-more); }
  .pct { text-align: right; color: var(--fc-muted); }
  ul { margin: 8px 0 0; padding-left: 16px; }
  li.improving { color: var(--fc-more); }
  li.worse { color: var(--fc-less); }
  .foot { margin-top: 8px; }
  .link { border: 0; background: transparent; color: var(--fc-muted); text-decoration: underline; padding: 0; }
  .toast { margin-top: 6px; color: var(--fc-more); }
  .pill { padding: 6px 12px; border-radius: 16px; border: 1px solid var(--fc-line); background: var(--fc-bg);
    color: var(--fc-text); box-shadow: var(--fc-shadow); }
`;

/** Builds an element without HTML strings. */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; title?: string; hidden?: boolean; type?: string } = {},
  ...children: (Node | string | null | false)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.title) node.title = props.title;
  if (props.hidden) node.hidden = true;
  if (props.type) node.setAttribute("type", props.type);
  for (const child of children) if (child) node.append(child);
  return node;
}

function style(css: string): HTMLStyleElement {
  const node = document.createElement("style");
  node.textContent = css;
  return node;
}

export interface CardView {
  item: FeedItem;
  classification: Classification;
  goal: GoalDirection | null;
  /** Advice shown on "less" videos; personalised once the user's own results are in. */
  lessTip: string;
}

export interface Handlers {
  correct(item: FeedItem, topic: TopicId, scope: CorrectionScope): Promise<string>;
  /** The user says they already used one of YouTube's feedback buttons on this video. */
  reportAction(item: FeedItem, kind: FeedbackKind): Promise<string>;
  setPanelCollapsed(collapsed: boolean): void;
  setMarkersHidden(hidden: boolean): void;
}

// ---------- Card labels ----------

export function renderCardLabel(card: Element, view: CardView, topics: Topic[], handlers: Handlers): void {
  let host = card.querySelector<HTMLElement>(`:scope > [${HOST_ATTR}='label']`);
  const signature = `${view.item.videoId}|${view.classification.topic}|${view.classification.source}|${view.goal ?? ""}|${view.lessTip}|${topics.map((t) => t.id).join(",")}`;
  if (host?.dataset.signature === signature) return;

  if (!host) {
    host = document.createElement("div");
    host.setAttribute(HOST_ATTR, "label");
    host.style.cssText = "position:absolute;top:8px;left:8px;z-index:20;";
    if (getComputedStyle(card).position === "static") (card as HTMLElement).style.position = "relative";
    card.prepend(host);
    host.attachShadow({ mode: "open" });
  }
  host.dataset.signature = signature;

  const { topic, source } = view.classification;
  const unsorted = topic === UNSORTED;
  const tone = unsorted ? "unsorted" : (view.goal ?? "neutral");
  const label = unsorted ? "Unsorted · sort it" : topicName(topics, topic);
  const tip = view.goal === "less" ? view.lessTip : view.goal === "more" ? "Matches your goal: watching helps" : "";

  const chip = h("button", { className: `chip ${tone}`, title: `Feed Coach: ${label}${source === "keywords" ? " (guessed from keywords)" : ""}. Click to change.` }, label);
  const status = h("div", { className: "status" });
  const options = h("div", { className: "options" });
  const wholeChannel = view.item.channel ? h("input", { type: "checkbox", className: "whole-channel" }) : null;
  if (wholeChannel) wholeChannel.checked = true;

  // Fallback for when Feed Coach didn't notice the user's own YouTube feedback click.
  const toldButtons = (Object.keys(ACTION_LABELS) as FeedbackKind[]).map((kind) => {
    const button = h("button", { type: "button" }, ACTION_LABELS[kind]);
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      status.textContent = "Saving…";
      status.textContent = await handlers.reportAction(view.item, kind);
    });
    return button;
  });

  const menu = h(
    "div",
    { className: "menu", hidden: true },
    h("p", {}, "What is this video about?"),
    wholeChannel && h("label", {}, wholeChannel, `All videos from ${view.item.channel}`),
    options,
    h("div", { className: "told" }, h("p", {}, "Already used YouTube's ⋮ menu on this? Tell Feed Coach so it can check whether it worked:"), h("div", { className: "options" }, ...toldButtons)),
    status,
  );

  const suggested = new Set(view.classification.candidates ?? []);
  const sorted = [...topics].sort((a, b) => Number(suggested.has(b.id)) - Number(suggested.has(a.id)) || a.name.localeCompare(b.name));
  for (const t of sorted) {
    const classes = [t.id === topic ? "current" : "", suggested.has(t.id) ? "suggested" : ""].join(" ").trim();
    const button = h("button", { type: "button", className: classes }, t.name);
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      status.textContent = "Saving…";
      status.textContent = await handlers.correct(view.item, t.id, wholeChannel?.checked ? "channel" : "video");
      setTimeout(() => (menu.hidden = true), 1500);
    });
    options.append(button);
  }

  chip.addEventListener("click", (event) => {
    // Don't let the click open the video underneath.
    event.preventDefault();
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    status.textContent = "";
  });
  menu.addEventListener("click", (event) => event.stopPropagation());

  host.shadowRoot!.replaceChildren(style(LABEL_CSS), chip, tip ? h("div", { className: "tip" }, tip) : "", menu);
}

export function removeAllLabels(root: ParentNode): void {
  root.querySelectorAll(`[${HOST_ATTR}='label']`).forEach((el) => el.remove());
}

// ---------- Panel ----------

export interface PanelView {
  shares: Shares;
  itemCount: number;
  unsortedCount: number;
  progress: GoalProgress[];
  goals: Record<TopicId, GoalDirection>;
  collapsed: boolean;
  markersHidden: boolean;
  topics: Topic[];
  /** One line about tracked YouTube actions, or null if there are none. */
  actionsLine: string | null;
}

export function renderPanel(view: PanelView, handlers: Handlers): void {
  let host = document.querySelector<HTMLElement>(`body > [${HOST_ATTR}='panel']`);
  if (!host) {
    host = document.createElement("div");
    host.setAttribute(HOST_ATTR, "panel");
    host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2200;";
    document.body.append(host);
    host.attachShadow({ mode: "open" });
  }
  const shadow = host.shadowRoot!;
  const signature = JSON.stringify(view);
  if (host.dataset.signature === signature) return; // nothing changed; keep hover/focus state
  host.dataset.signature = signature;
  const toastText = shadow.querySelector(".toast")?.textContent ?? "";

  if (view.collapsed) {
    const pill = h("button", { className: "pill", title: "Show Feed Coach" }, "Feed Coach ▴");
    pill.addEventListener("click", () => handlers.setPanelCollapsed(false));
    shadow.replaceChildren(style(PANEL_CSS), pill);
    return;
  }

  const rows = Object.entries(view.shares)
    .filter(([topic]) => topic !== UNSORTED)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, share]) => {
      const goal = view.goals[topic];
      const fill = h("span", { className: `fill ${goal ?? ""}` });
      fill.style.width = `${Math.round(share * 100)}%`;
      return h(
        "div",
        { className: "row" },
        h(
          "span",
          { className: "name" },
          topicName(view.topics, topic),
          goal ? h("span", { className: `mark ${goal}`, title: goal === "more" ? "You want more" : "You want less" }, goal === "more" ? " ▲" : " ▼") : null,
        ),
        h("span", { className: "bar" }, fill),
        h("span", { className: "pct" }, pct(share)),
      );
    });

  const progress = view.progress.map((p) => {
    const name = topicName(view.topics, p.topic);
    const verb = p.direction === "more" ? "More" : "Less";
    if (p.status === "too-early") {
      return h("li", {}, `${verb} ${name}: measuring…${p.before !== null ? ` (started at ${pct(p.before)})` : ""}`);
    }
    const verdict = { improving: "improving", "no-change": "no real change yet", worse: "going the wrong way" }[p.status];
    return h("li", { className: p.status }, `${verb} ${name}: ${pct(p.before ?? 0)} → ${pct(p.now ?? 0)} · ${verdict}`);
  });

  const collapse = h("button", { className: "icon", title: "Minimise" }, "▾");
  collapse.addEventListener("click", () => handlers.setPanelCollapsed(true));
  const markers = h("button", { className: "link" }, view.markersHidden ? "Show labels" : "Hide labels");
  markers.addEventListener("click", () => handlers.setMarkersHidden(!view.markersHidden));

  const body: (Node | null)[] =
    view.itemCount === 0
      ? [h("p", { className: "muted" }, "Waiting for recommendations…")]
      : rows.length > 0
        ? rows
        : [h("p", { className: "muted" }, "Nothing sorted yet.")];

  const panel = h(
    "div",
    { className: "panel" },
    h("header", {}, h("h2", {}, "Your feed right now"), collapse),
    ...body,
    h("p", { className: "muted" }, `${view.itemCount} videos on this page${view.unsortedCount ? ` · ${view.unsortedCount} unsorted: click a grey label to sort it` : ""}`),
    progress.length > 0 ? h("ul", {}, ...progress) : h("p", { className: "muted" }, "No goals yet. Click the Feed Coach icon to set one."),
    view.actionsLine ? h("p", { className: "muted" }, view.actionsLine) : null,
    h("div", { className: "foot" }, markers),
    h("div", { className: "toast" }, toastText),
  );
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Feed Coach");
  shadow.replaceChildren(style(PANEL_CSS), panel);
}

export function showToast(text: string): void {
  const toast = document.querySelector<HTMLElement>(`body > [${HOST_ATTR}='panel']`)?.shadowRoot?.querySelector(".toast");
  if (toast) toast.textContent = text;
}

export function removePanel(): void {
  document.querySelector(`body > [${HOST_ATTR}='panel']`)?.remove();
}

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}
