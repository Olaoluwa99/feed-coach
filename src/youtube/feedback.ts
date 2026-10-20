// Notices when the user uses YouTube's own feedback buttons on a homepage video
// (decision 0007). It only watches clicks; it never clicks anything itself.
//
// How a feedback action looks in the page (checked 2026-10-20):
//   1. The user clicks the ⋮ button inside a homepage card (ytd-rich-item-renderer).
//   2. YouTube opens a menu in ytd-popup-container: yt-list-view-model[role=menu]
//      > yt-list-item-view-model > button[role=menuitem] with the label as text.
//   3. After "Not interested" / "Don't recommend channel", the card shows a notice
//      with an "Undo" button.
import { isUndoLabel, matchMenuLabel, UNDO_WINDOW_MS } from "../core/actions";
import type { FeedbackKind, FeedItem } from "../core/types";
import { readCard } from "./homepage";

const CARD = "ytd-rich-item-renderer";
const MENU_ITEM = "[role='menuitem'], yt-list-item-view-model, ytd-menu-service-item-renderer, tp-yt-paper-item";
const MENU_CONTAINER = "ytd-popup-container, tp-yt-iron-dropdown, yt-sheet-view-model, [role='menu']";
/** A menu choice counts only if its menu was opened from a card this recently. */
const MENU_OPEN_WINDOW_MS = 60_000;

export type ClickKind =
  | { kind: "menu-item"; label: string }
  | { kind: "undo"; card: Element | null }
  | { kind: "card-button"; card: Element }
  | null;

/**
 * What a click was, from its event path (innermost element first).
 * Separate from the listener so it can be checked against YouTube's real markup.
 */
export function classifyClick(path: Element[]): ClickKind {
  // A click on a menu item in YouTube's popup menu.
  const menuItem = path.find((el) => el.matches(MENU_ITEM) && el.closest(MENU_CONTAINER));
  if (menuItem) return { kind: "menu-item", label: menuItem.textContent ?? "" };

  const card = path.find((el) => el.matches(CARD)) ?? null;

  // "Undo", with the card it's in (if any), so it can be matched to the right action.
  const button = path.find((el) => el.matches("button, [role='button']"));
  if (button && isUndoLabel(button.textContent ?? "")) return { kind: "undo", card };

  // A button inside a video card that isn't a link or Feed Coach's own label: probably the ⋮ menu.
  if (!card) return null;
  const beforeCard = path.slice(0, path.indexOf(card));
  if (beforeCard.some((el) => el.hasAttribute("data-feed-coach") || el.matches("a[href]"))) return null;
  if (!beforeCard.some((el) => el.matches("button, [role='button']"))) return null;
  return { kind: "card-button", card };
}

export interface FeedbackCallbacks {
  onAction(kind: FeedbackKind, item: Omit<FeedItem, "position">): void;
  /** The user clicked Undo on the card of a video they just gave feedback on. */
  onUndo(videoId: string): void;
}

/** Starts watching clicks. `isHomeCard` limits it to cards on the homepage. Returns a function that stops watching. */
export function watchFeedbackClicks(isHomeCard: (card: Element) => boolean, callbacks: FeedbackCallbacks, now: () => number = Date.now): () => void {
  /** The homepage card whose ⋮ menu was most likely just opened. */
  let opened: { item: Omit<FeedItem, "position">; at: number } | null = null;
  /** Recent detected actions, kept so an Undo can be matched to its own card. */
  let recent: { videoId: string; card: Element; at: number }[] = [];
  let openedCard: Element | null = null;

  const onClick = (event: Event) => {
    const click = classifyClick(event.composedPath().filter((n): n is Element => n instanceof Element));

    if (click?.kind === "menu-item") {
      const kind = matchMenuLabel(click.label);
      if (kind && opened && openedCard && now() - opened.at <= MENU_OPEN_WINDOW_MS) {
        callbacks.onAction(kind, opened.item);
        recent = [...recent.filter((r) => now() - r.at <= UNDO_WINDOW_MS), { videoId: opened.item.videoId, card: openedCard, at: now() }];
      }
      opened = null;
      openedCard = null;
      return;
    }

    // Any other click replaces what we remember, so a stale menu can't be credited later.
    opened = null;
    openedCard = null;

    if (click?.kind === "undo") {
      // Only an Undo inside the card of a recent action counts; Undo buttons elsewhere
      // on YouTube (e.g. "Saved to Watch later · Undo") are ignored.
      const match = click.card ? [...recent].reverse().find((r) => r.card === click.card && now() - r.at <= UNDO_WINDOW_MS) : undefined;
      if (match) {
        callbacks.onUndo(match.videoId);
        recent = recent.filter((r) => r !== match);
      }
      return;
    }

    if (click?.kind === "card-button" && isHomeCard(click.card)) {
      const item = readCard(click.card);
      if (item) {
        opened = { item, at: now() };
        openedCard = click.card;
      }
    }
  };

  // Leaving the page (YouTube is a single-page app) forgets any open menu.
  const onNavigate = () => {
    opened = null;
    openedCard = null;
  };

  // Capture phase: YouTube may stop the click from bubbling once it handles it.
  document.addEventListener("click", onClick, true);
  document.addEventListener("yt-navigate-start", onNavigate);
  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("yt-navigate-start", onNavigate);
  };
}
