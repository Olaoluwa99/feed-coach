// Reads recommended videos from the YouTube homepage DOM.
//
// YouTube changes its markup without notice, so every field has fallbacks:
//   - current layout (checked 2026-10-20): ytd-rich-item-renderer > yt-lockup-view-model
//   - older layout:          ytd-rich-item-renderer > ytd-rich-grid-media
// If both stop matching, readHomepage returns [] and the popup says so.
import type { FeedItem, HomepageState } from "../core/types";

const MAX_ITEMS = 40;

export function isHomepage(url: URL): boolean {
  return url.hostname === "www.youtube.com" && url.pathname === "/";
}

/**
 * The homepage's own section of the page. YouTube keeps previously visited pages
 * (e.g. a channel's video grid) hidden in the DOM, so reading the whole document
 * would mix their cards into the homepage.
 */
export function homeRoot(doc: Document): ParentNode | null {
  return doc.querySelector("ytd-browse[page-subtype='home']");
}

export function homepageState(root: ParentNode): HomepageState {
  if (root.querySelector("ytd-rich-item-renderer a[href*='/watch?v='], ytd-rich-item-renderer a[href^='/shorts/']")) {
    return "ready";
  }
  const grid = root.querySelector("ytd-rich-grid-renderer");
  if (grid && /history is off/i.test(grid.textContent ?? "")) return "history-off";
  return "loading";
}

export function readHomepage(root: ParentNode): { items: FeedItem[]; adsSkipped: number } {
  const { cards, adsSkipped } = readCards(root, MAX_ITEMS);
  return { items: cards.map((c) => c.item), adsSkipped };
}

/** Each readable card with its element, so the UI can attach markers to it. */
export function readCards(root: ParentNode, limit = Infinity): { cards: { element: Element; item: FeedItem }[]; adsSkipped: number } {
  const cards: { element: Element; item: FeedItem }[] = [];
  const seen = new Set<string>();
  let adsSkipped = 0;

  for (const element of root.querySelectorAll("ytd-rich-item-renderer")) {
    if (cards.length >= limit) break;
    if (element.querySelector("ytd-ad-slot-renderer")) {
      adsSkipped++;
      continue;
    }
    const item = readCard(element);
    if (!item || seen.has(item.videoId)) continue;
    seen.add(item.videoId);
    cards.push({ element, item: { ...item, position: cards.length } });
  }

  return { cards, adsSkipped };
}

/** Reads one card (title, channel, video ID), or null if it isn't a readable video. */
export function readCard(card: Element): Omit<FeedItem, "position"> | null {
  const shortLink = card.querySelector<HTMLAnchorElement>("a[href^='/shorts/']");
  const videoLink = card.querySelector<HTMLAnchorElement>("a[href*='/watch?v=']");
  const link = videoLink ?? shortLink;
  if (!link) return null;

  const href = link.getAttribute("href") ?? "";
  const videoId = videoLink ? watchId(href) : href.split("/shorts/")[1]?.split(/[?&#]/)[0];
  if (!videoId) return null;

  const title = readTitle(card, link);
  if (!title) return null;

  const channelLink = card.querySelector<HTMLAnchorElement>(
    "yt-content-metadata-view-model a[href^='/@'], yt-content-metadata-view-model a[href^='/channel/'], ytd-channel-name a",
  );
  const channel = clean(channelLink?.textContent) || firstMetadataText(card);

  return {
    kind: videoLink ? "video" : "short",
    videoId,
    title,
    channel: channel || null,
    channelUrl: channelLink?.getAttribute("href") ?? null,
  };
}

function watchId(href: string): string | undefined {
  const query = href.split("?")[1];
  return query ? new URLSearchParams(query).get("v") ?? undefined : undefined;
}

function readTitle(card: Element, link: HTMLAnchorElement): string {
  const heading = card.querySelector("h3[title]");
  return (
    clean(heading?.getAttribute("title")) ||
    clean(card.querySelector("#video-title")?.textContent) ||
    clean(card.querySelector("h3")?.textContent) ||
    clean(link.textContent)
  );
}

/** In the lockup layout without a channel link, the first metadata text is the channel. */
function firstMetadataText(card: Element): string {
  const first = card.querySelector("yt-content-metadata-view-model [role='text']");
  return clean(first?.textContent);
}

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}
