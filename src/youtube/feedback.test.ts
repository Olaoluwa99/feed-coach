// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { watchFeedbackClicks } from "./feedback";

// Markup mirrors YouTube's (checked 2026-10-20); titles are invented.
function setup(menuLabels = ["Add to queue", "Not interested", "Don't recommend channel"]) {
  document.body.innerHTML = `
    <ytd-browse page-subtype="home">
      <ytd-rich-item-renderer id="card">
        <div data-feed-coach="label"><button id="our-chip">Gossip</button></div>
        <yt-lockup-view-model>
          <a id="thumb" href="/watch?v=abc123"></a>
          <h3 title="Celebrity feud explained"><a href="/watch?v=abc123">Celebrity feud explained</a></h3>
          <yt-content-metadata-view-model><span role="text"><a href="/@gist">Gist Central</a></span></yt-content-metadata-view-model>
          <div class="ytLockupMetadataViewModelMenuButton"><button id="menu-button" aria-label="More actions"><span id="menu-icon"></span></button></div>
        </yt-lockup-view-model>
        <button id="card-undo">Undo</button>
      </ytd-rich-item-renderer>
    </ytd-browse>
    <ytd-popup-container>
      <yt-list-view-model role="menu">
        ${menuLabels.map((label, i) => `<yt-list-item-view-model role="presentation"><button id="item-${i}" role="menuitem"><span>${label}</span></button></yt-list-item-view-model>`).join("")}
      </yt-list-view-model>
    </ytd-popup-container>
    <a id="elsewhere" href="/watch?v=other">Another video</a>
    <button id="toast-undo">Undo</button>`;

  const onAction = vi.fn();
  const onUndo = vi.fn();
  let time = 1_000_000;
  const stop = watchFeedbackClicks(() => true, { onAction, onUndo }, () => time);
  const click = (id: string) => document.getElementById(id)!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
  return { onAction, onUndo, click, stop, advance: (ms: number) => (time += ms) };
}

let stopWatching: (() => void) | undefined;
afterEach(() => stopWatching?.());

describe("watchFeedbackClicks", () => {
  it("records Not interested chosen from a card's ⋮ menu", () => {
    const t = setup();
    stopWatching = t.stop;
    t.click("menu-icon");
    t.click("item-1");
    expect(t.onAction).toHaveBeenCalledWith("not-interested", expect.objectContaining({ videoId: "abc123", channel: "Gist Central" }));
  });

  it("records Don't recommend channel", () => {
    const t = setup();
    stopWatching = t.stop;
    t.click("menu-button");
    t.click("item-2");
    expect(t.onAction).toHaveBeenCalledWith("dont-recommend-channel", expect.objectContaining({ videoId: "abc123" }));
  });

  it("ignores other menu items", () => {
    const t = setup();
    stopWatching = t.stop;
    t.click("menu-button");
    t.click("item-0");
    expect(t.onAction).not.toHaveBeenCalled();
  });

  it("ignores a menu choice when no card menu was opened recently", () => {
    const t = setup();
    stopWatching = t.stop;
    t.click("menu-button");
    t.advance(61_000);
    t.click("item-1");
    expect(t.onAction).not.toHaveBeenCalled();
  });

  it("forgets the opened card after any other click", () => {
    // Found in review: open ⋮ on A, press Esc, click a video, then a menu elsewhere was credited to A.
    const t = setup();
    stopWatching = t.stop;
    t.click("menu-button");
    t.click("elsewhere");
    t.click("item-1");
    expect(t.onAction).not.toHaveBeenCalled();
  });

  it("forgets the opened card when YouTube navigates", () => {
    const t = setup();
    stopWatching = t.stop;
    t.click("menu-button");
    document.dispatchEvent(new Event("yt-navigate-start"));
    t.click("item-1");
    expect(t.onAction).not.toHaveBeenCalled();
  });

  it("doesn't treat clicks on links or on Feed Coach's own label as opening the menu", () => {
    const t = setup();
    stopWatching = t.stop;
    t.click("thumb");
    t.click("item-1");
    t.click("our-chip");
    t.click("item-1");
    expect(t.onAction).not.toHaveBeenCalled();
  });

  it("reports Undo inside the card of a recent action, with its video", () => {
    const t = setup();
    stopWatching = t.stop;
    t.click("menu-button");
    t.click("item-1");
    t.click("card-undo");
    expect(t.onUndo).toHaveBeenCalledWith("abc123");
  });

  it("ignores Undo buttons elsewhere on YouTube, and Undo after 2 minutes", () => {
    // Found in review: "Saved to Watch later · Undo" undid the latest feedback action.
    const t = setup();
    stopWatching = t.stop;
    t.click("menu-button");
    t.click("item-1");
    t.click("toast-undo");
    t.advance(121_000);
    t.click("card-undo");
    expect(t.onUndo).not.toHaveBeenCalled();
  });

  it("stops watching", () => {
    const t = setup();
    t.stop();
    t.click("menu-button");
    t.click("item-1");
    expect(t.onAction).not.toHaveBeenCalled();
  });
});
