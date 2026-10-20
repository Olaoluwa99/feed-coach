// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { homepageState, homeRoot, isHomepage, readHomepage } from "./homepage";

// Hand-made markup mirroring YouTube's real structure (checked 2026-10-20).
// Titles and channels are invented.
const lockupWithChannelLink = (id: string, title: string, channel: string, handle: string) => `
  <ytd-rich-item-renderer>
    <yt-lockup-view-model>
      <a href="/watch?v=${id}" class="ytLockupViewModelContentImage"></a>
      <yt-lockup-metadata-view-model>
        <h3 title="${title}"><a href="/watch?v=${id}&pp=abc"><span role="text">${title}</span></a></h3>
        <yt-content-metadata-view-model>
          <div class="ytContentMetadataViewModelMetadataRow">
            <span role="text"><a href="${handle}">${channel}</a></span>
          </div>
          <div class="ytContentMetadataViewModelMetadataRow">
            <span role="text">12k views</span><span role="text">2 days ago</span>
          </div>
        </yt-content-metadata-view-model>
      </yt-lockup-metadata-view-model>
    </yt-lockup-view-model>
  </ytd-rich-item-renderer>`;

const lockupWithoutChannelLink = `
  <ytd-rich-item-renderer>
    <yt-lockup-view-model>
      <h3 title="Jollof rice three ways"><a href="/watch?v=ccc333"><span role="text">Jollof rice three ways</span></a></h3>
      <yt-content-metadata-view-model>
        <div><span role="text">Kitchen Corner</span><span role="text">702k</span><span role="text">23 hr ago</span></div>
      </yt-content-metadata-view-model>
    </yt-lockup-view-model>
  </ytd-rich-item-renderer>`;

const adSlot = `
  <ytd-rich-item-renderer>
    <ytd-ad-slot-renderer><a href="/watch?v=adadad">Buy things</a></ytd-ad-slot-renderer>
  </ytd-rich-item-renderer>`;

const legacyGridMedia = `
  <ytd-rich-item-renderer>
    <ytd-rich-grid-media>
      <a id="video-title-link" href="/watch?v=ddd444"><yt-formatted-string id="video-title">  Old layout   video </yt-formatted-string></a>
      <ytd-channel-name><a href="/@oldchannel">Old Channel</a></ytd-channel-name>
    </ytd-rich-grid-media>
  </ytd-rich-item-renderer>`;

const short = `
  <ytd-rich-item-renderer>
    <ytm-shorts-lockup-view-model>
      <a href="/shorts/sss555"></a>
      <h3><a href="/shorts/sss555"><span>60 second goal</span></a></h3>
    </ytm-shorts-lockup-view-model>
  </ytd-rich-item-renderer>`;

function page(cards: string): Document {
  const doc = document.implementation.createHTMLDocument("YouTube");
  doc.body.innerHTML = `<ytd-browse page-subtype="home"><ytd-rich-grid-renderer><div id="contents">${cards}</div></ytd-rich-grid-renderer></ytd-browse>`;
  return doc;
}

describe("homeRoot", () => {
  it("ignores hidden cards left over from other pages", () => {
    // Visiting a channel and then the homepage leaves the channel's grid hidden in the DOM.
    const doc = document.implementation.createHTMLDocument("YouTube");
    doc.body.innerHTML = `
      <ytd-browse page-subtype="channels" hidden><ytd-rich-grid-renderer>${lockupWithoutChannelLink}</ytd-rich-grid-renderer></ytd-browse>
      <ytd-browse page-subtype="home"><ytd-rich-grid-renderer>${legacyGridMedia}</ytd-rich-grid-renderer></ytd-browse>`;
    const root = homeRoot(doc);
    expect(root).not.toBeNull();
    expect(readHomepage(root!).items.map((i) => i.videoId)).toEqual(["ddd444"]);
  });

  it("is null before the homepage section exists", () => {
    expect(homeRoot(document.implementation.createHTMLDocument("YouTube"))).toBeNull();
  });
});

describe("readHomepage", () => {
  it("reads videos in order with title, channel and link", () => {
    const doc = page(
      lockupWithChannelLink("aaa111", "Derby highlights", "Football Daily", "/@footballdaily") +
        lockupWithChannelLink("bbb222", "Celebrity feud explained", "Gist Central", "/@gistcentral"),
    );
    const { items } = readHomepage(doc);
    expect(items).toEqual([
      { position: 0, kind: "video", videoId: "aaa111", title: "Derby highlights", channel: "Football Daily", channelUrl: "/@footballdaily" },
      { position: 1, kind: "video", videoId: "bbb222", title: "Celebrity feud explained", channel: "Gist Central", channelUrl: "/@gistcentral" },
    ]);
  });

  it("falls back to the first metadata text when there's no channel link", () => {
    const { items } = readHomepage(page(lockupWithoutChannelLink));
    expect(items[0]).toMatchObject({ videoId: "ccc333", title: "Jollof rice three ways", channel: "Kitchen Corner", channelUrl: null });
  });

  it("skips ads and counts them", () => {
    const { items, adsSkipped } = readHomepage(page(adSlot + lockupWithoutChannelLink));
    expect(adsSkipped).toBe(1);
    expect(items.map((i) => i.videoId)).toEqual(["ccc333"]);
    expect(items[0]?.position).toBe(0);
  });

  it("reads the older ytd-rich-grid-media layout", () => {
    const { items } = readHomepage(page(legacyGridMedia));
    expect(items[0]).toMatchObject({ videoId: "ddd444", title: "Old layout video", channel: "Old Channel", channelUrl: "/@oldchannel" });
  });

  it("reads Shorts without a channel", () => {
    const { items } = readHomepage(page(short));
    expect(items[0]).toMatchObject({ kind: "short", videoId: "sss555", title: "60 second goal", channel: null });
  });

  it("drops duplicate videos", () => {
    const card = lockupWithChannelLink("aaa111", "Derby highlights", "Football Daily", "/@footballdaily");
    expect(readHomepage(page(card + card)).items).toHaveLength(1);
  });
});

describe("homepageState", () => {
  it("is ready when recommendations are showing", () => {
    expect(homepageState(page(lockupWithoutChannelLink))).toBe("ready");
  });

  it("detects YouTube history being off", () => {
    const doc = page(`<ytd-rich-section-renderer>Your YouTube History is off. You can turn on watch history…</ytd-rich-section-renderer>`);
    expect(homepageState(doc)).toBe("history-off");
  });

  it("is loading when the grid is empty", () => {
    expect(homepageState(page(""))).toBe("loading");
  });
});

describe("isHomepage", () => {
  it("matches only the YouTube home path", () => {
    expect(isHomepage(new URL("https://www.youtube.com/"))).toBe(true);
    expect(isHomepage(new URL("https://www.youtube.com/watch?v=x"))).toBe(false);
    expect(isHomepage(new URL("https://www.youtube.com/@channel"))).toBe(false);
  });
});
