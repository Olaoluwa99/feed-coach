import { describe, expect, it } from "vitest";
import { byKeywords, classify } from "./classify";
import { containsPhrase, DEFAULT_TOPICS, makeTopicId, normalize, UNSORTED } from "./topics";
import { EMPTY_COACH_DATA, type CoachData } from "./types";

const item = (title: string, channel: string | null = null, videoId = "v1") => ({ videoId, title, channel });

describe("normalize and containsPhrase", () => {
  it("lowercases and strips punctuation and accents", () => {
    expect(normalize("Café — BREAKING: News!!")).toBe("cafe breaking news");
  });

  it("matches whole words and phrases only", () => {
    expect(containsPhrase(normalize("New AI tools"), "ai")).toBe(true);
    expect(containsPhrase(normalize("She said no"), "ai")).toBe(false);
    expect(containsPhrase(normalize("Premier League highlights"), "premier league")).toBe(true);
  });
});

describe("byKeywords", () => {
  it("picks the topic with the most keyword hits", () => {
    expect(byKeywords(item("Arsenal vs Chelsea | Premier League highlights"), DEFAULT_TOPICS)).toEqual({ topic: "sports", source: "keywords" });
    expect(byKeywords(item("Easy jollof rice recipe"), DEFAULT_TOPICS).topic).toBe("food");
  });

  it("counts title matches above channel matches", () => {
    // "workout" in the title (fitness, 2 points) beats "tech" in the channel name (1 point).
    expect(byKeywords(item("Full body workout", "Tech Daily"), DEFAULT_TOPICS).topic).toBe("fitness");
  });

  it("returns unsorted with candidates on a tie", () => {
    const result = byKeywords(item("Gaming laptop"), [
      { id: "a", name: "A", keywords: ["gaming"] },
      { id: "b", name: "B", keywords: ["laptop"] },
    ]);
    expect(result).toEqual({ topic: UNSORTED, source: "none", candidates: ["a", "b"] });
  });

  it("returns unsorted when nothing matches", () => {
    expect(byKeywords(item("Qwerty zxcv"), DEFAULT_TOPICS)).toEqual({ topic: UNSORTED, source: "none" });
  });
});

describe("classify order", () => {
  const base: CoachData = { ...EMPTY_COACH_DATA, aiCache: { v1: "comedy" } };

  it("uses AI over keywords", () => {
    expect(classify(item("Football highlights", null, "v1"), base)).toEqual({ topic: "comedy", source: "ai" });
  });

  it("uses rules over AI, video rules over channel rules", () => {
    const data: CoachData = {
      ...base,
      rules: [
        { kind: "channel", channel: "Gist Central", topic: "gossip", createdAt: "2026-10-20T10:00:00Z" },
        { kind: "video", videoId: "v1", topic: "music", createdAt: "2026-10-20T09:00:00Z" },
      ],
    };
    expect(classify(item("x", "Gist Central", "v1"), data).topic).toBe("music");
    expect(classify(item("x", "gist  central", "v2"), data)).toEqual({ topic: "gossip", source: "channel-rule" });
  });

  it("applies keyword rules to titles, newest first", () => {
    const data: CoachData = {
      ...EMPTY_COACH_DATA,
      rules: [
        { kind: "keyword", keyword: "tottenham", topic: "sports", createdAt: "2026-10-20T09:00:00Z" },
        { kind: "keyword", keyword: "spurs", topic: "comedy", createdAt: "2026-10-20T10:00:00Z" },
      ],
    };
    expect(classify(item("Tottenham Spurs today"), data)).toEqual({ topic: "comedy", source: "keyword-rule" });
  });

  it("ignores AI answers for topics that no longer exist", () => {
    const data: CoachData = { ...EMPTY_COACH_DATA, aiCache: { v1: "custom-deleted" } };
    expect(classify(item("Easy jollof rice recipe", null, "v1"), data).topic).toBe("food");
  });

  it("uses custom topics' keywords", () => {
    const data: CoachData = { ...EMPTY_COACH_DATA, customTopics: [{ id: "custom-chess", name: "Chess", keywords: ["chess", "magnus"], custom: true }] };
    expect(classify(item("Magnus plays blitz chess"), data).topic).toBe("custom-chess");
  });
});

describe("makeTopicId", () => {
  it("makes unique ids", () => {
    const existing = [{ id: "custom-chess", name: "Chess", keywords: [] }];
    expect(makeTopicId("Chess!", existing)).toBe("custom-chess-2");
    expect(makeTopicId("Board games", existing)).toBe("custom-board-games");
  });
});
