import { describe, expect, it } from "vitest";
import { classify } from "./classify";
import { addKeywordRule, allExamplesPass, applyCorrection, removeRule } from "./rules";
import { EMPTY_COACH_DATA, type FeedItem, type Snapshot } from "./types";

const item = (videoId: string, title: string, channel: string | null): FeedItem => ({ position: 0, kind: "video", videoId, title, channel, channelUrl: null });
const history: Snapshot[] = [
  {
    takenAt: "2026-10-19T10:00:00Z",
    adsSkipped: 0,
    items: [item("a1", "Morning show", "Gist Central"), item("a2", "Evening show", "Gist Central"), item("b1", "Football talk", "Pitch Side")],
  },
];

describe("applyCorrection", () => {
  it("adds a channel rule and an example, and reports past changes", () => {
    const report = applyCorrection(EMPTY_COACH_DATA, item("a1", "Morning show", "Gist Central"), "gossip", "channel", history, "2026-10-20T10:00:00Z");
    expect(report.rule).toEqual({ kind: "channel", channel: "Gist Central", topic: "gossip", createdAt: "2026-10-20T10:00:00Z" });
    expect(report.data.examples).toHaveLength(1);
    expect(report.pastItemsChanged).toBe(2); // a1 and a2 were unsorted, now gossip
    expect(report.exceptionsAdded).toEqual([]);
    expect(allExamplesPass(report.data)).toBe(true);
  });

  it("falls back to a video rule when the item has no channel", () => {
    const report = applyCorrection(EMPTY_COACH_DATA, item("s1", "Short clip", null), "comedy", "channel", [], "2026-10-20T10:00:00Z");
    expect(report.rule.kind).toBe("video");
  });

  it("never silently breaks an earlier label: it pins it as an exception", () => {
    // Earlier: user said a2 (from Gist Central) is music, just this video.
    const first = applyCorrection(EMPTY_COACH_DATA, item("a2", "Evening show", "Gist Central"), "music", "video", history, "2026-10-20T09:00:00Z").data;
    // Later: user says the whole channel is gossip. a2 must stay music.
    const report = applyCorrection(first, item("a1", "Morning show", "Gist Central"), "gossip", "channel", history, "2026-10-20T10:00:00Z");
    expect(classify(item("a2", "Evening show", "Gist Central"), report.data).topic).toBe("music");
    expect(classify(item("a1", "Morning show", "Gist Central"), report.data).topic).toBe("gossip");
    expect(allExamplesPass(report.data)).toBe(true);
  });

  it("pins an earlier channel-wide label when a new channel rule replaces it", () => {
    const first = applyCorrection(EMPTY_COACH_DATA, item("a1", "Morning show", "Gist Central"), "gossip", "channel", history, "2026-10-20T09:00:00Z").data;
    const report = applyCorrection(first, item("a2", "Evening show", "Gist Central"), "news", "channel", history, "2026-10-20T10:00:00Z");
    expect(report.exceptionsAdded.map((e) => e.videoId)).toEqual(["a1"]);
    expect(classify(item("a1", "Morning show", "Gist Central"), report.data).topic).toBe("gossip");
    expect(classify(item("a9", "New show", "Gist Central"), report.data).topic).toBe("news");
    expect(report.data.rules.filter((r) => r.kind === "channel")).toHaveLength(1);
  });

  it("re-labelling a video channel-wide replaces its own old label instead of reporting an exception", () => {
    // Found in review: the video's own earlier video rule was reported as "1 earlier label kept".
    const first = applyCorrection(EMPTY_COACH_DATA, item("a1", "Morning show", "Gist Central"), "music", "video", history, "2026-10-20T09:00:00Z").data;
    const report = applyCorrection(first, item("a1", "Morning show", "Gist Central"), "gossip", "channel", history, "2026-10-20T10:00:00Z");
    expect(report.exceptionsAdded).toEqual([]);
    expect(classify(item("a1", "Morning show", "Gist Central"), report.data).topic).toBe("gossip");
    expect(report.data.rules).toEqual([{ kind: "channel", channel: "Gist Central", topic: "gossip", createdAt: "2026-10-20T10:00:00Z" }]);
    expect(allExamplesPass(report.data)).toBe(true);
  });

  it("replaces the example when the same video is corrected again", () => {
    const first = applyCorrection(EMPTY_COACH_DATA, item("a1", "Morning show", "Gist Central"), "gossip", "video", [], "2026-10-20T09:00:00Z").data;
    const second = applyCorrection(first, item("a1", "Morning show", "Gist Central"), "comedy", "video", [], "2026-10-20T10:00:00Z").data;
    expect(second.examples).toHaveLength(1);
    expect(classify(item("a1", "Morning show", "Gist Central"), second).topic).toBe("comedy");
  });
});

describe("addKeywordRule", () => {
  it("adds a keyword rule but keeps earlier examples correct", () => {
    const first = applyCorrection(EMPTY_COACH_DATA, item("b1", "Football talk", "Pitch Side"), "comedy", "video", history, "2026-10-20T09:00:00Z").data;
    const report = addKeywordRule(first, "football", "sports", history, "2026-10-20T10:00:00Z");
    expect(classify(item("x", "Football tonight", null), report.data).topic).toBe("sports");
    expect(allExamplesPass(report.data)).toBe(true);
  });
});

describe("removeRule", () => {
  it("removes rules with the same target", () => {
    const data = applyCorrection(EMPTY_COACH_DATA, item("a1", "Morning show", "Gist Central"), "gossip", "channel", [], "2026-10-20T09:00:00Z").data;
    const rule = data.rules[0]!;
    expect(removeRule(data, rule).rules).toEqual([]);
  });
});
