import { describe, expect, it } from "vitest";
import { averageShares, goalProgress, rankShares, topicShares, whatToAsk } from "./stats";
import { EMPTY_COACH_DATA, type CoachData, type FeedItem, type Snapshot } from "./types";

const item = (videoId: string, title: string, channel: string | null = null): FeedItem => ({ position: 0, kind: "video", videoId, title, channel, channelUrl: null });

/** A snapshot with `gossip` gossip items out of 10 (the rest are cooking). */
const snap = (takenAt: string, gossip: number): Snapshot => ({
  takenAt,
  adsSkipped: 0,
  items: Array.from({ length: 10 }, (_, i) => (i < gossip ? item(`g${i}`, "Celebrity drama exposed") : item(`f${i}`, "Easy recipe"))),
});

describe("topicShares", () => {
  it("gives each topic's fraction of items", () => {
    const shares = topicShares(snap("2026-10-20T00:00:00Z", 3).items, EMPTY_COACH_DATA);
    expect(shares.gossip).toBeCloseTo(0.3);
    expect(shares.food).toBeCloseTo(0.7);
  });

  it("averages per snapshot and ranks", () => {
    const avg = averageShares([snap("2026-10-20T00:00:00Z", 2), snap("2026-10-20T01:00:00Z", 4)], EMPTY_COACH_DATA);
    expect(avg.gossip).toBeCloseTo(0.3);
    expect(rankShares(avg)[0]?.topic).toBe("food");
  });
});

describe("goalProgress", () => {
  const goals = (since: string): CoachData => ({ ...EMPTY_COACH_DATA, goals: { gossip: { direction: "less", since } } });

  it("is too early without enough data after the goal", () => {
    const snapshots = [snap("2026-10-10T10:00:00Z", 5), snap("2026-10-15T10:00:00Z", 4)];
    const [p] = goalProgress(snapshots, goals("2026-10-14T00:00:00Z"), new Date("2026-10-15T12:00:00Z"));
    expect(p?.status).toBe("too-early");
    expect(p?.before).toBeCloseTo(0.5);
    expect(p?.now).toBeNull();
  });

  it("reports improving when a 'less' topic shrinks", () => {
    const snapshots = [
      snap("2026-10-10T10:00:00Z", 5),
      snap("2026-10-15T10:00:00Z", 3),
      snap("2026-10-16T10:00:00Z", 2),
      snap("2026-10-17T10:00:00Z", 1),
    ];
    const [p] = goalProgress(snapshots, goals("2026-10-14T00:00:00Z"), new Date("2026-10-17T12:00:00Z"));
    expect(p?.before).toBeCloseTo(0.5);
    expect(p?.now).toBeCloseTo(0.2);
    expect(p?.status).toBe("improving");
  });

  it("reports worse when a 'less' topic grows", () => {
    const snapshots = [snap("2026-10-10T10:00:00Z", 1), snap("2026-10-15T10:00:00Z", 3), snap("2026-10-16T10:00:00Z", 4), snap("2026-10-17T10:00:00Z", 5)];
    const [p] = goalProgress(snapshots, goals("2026-10-14T00:00:00Z"), new Date("2026-10-17T12:00:00Z"));
    expect(p?.status).toBe("worse");
  });

  it("uses the first day after the goal as 'before' when nothing came earlier", () => {
    const snapshots = [
      snap("2026-10-14T10:00:00Z", 6),
      snap("2026-10-14T18:00:00Z", 4),
      snap("2026-10-16T10:00:00Z", 2),
      snap("2026-10-17T10:00:00Z", 2),
      snap("2026-10-18T10:00:00Z", 2),
    ];
    const [p] = goalProgress(snapshots, goals("2026-10-14T00:00:00Z"), new Date("2026-10-18T12:00:00Z"));
    expect(p?.before).toBeCloseTo(0.5);
    expect(p?.now).toBeCloseTo(0.2);
    expect(p?.status).toBe("improving");
  });

  it("stays too early when all the data comes from minutes after the goal, even days later", () => {
    // Found in review: 3 visits within 12 minutes of setting the goal, popup opened 2 days later.
    const snapshots = [
      snap("2026-10-13T10:00:00Z", 10),
      snap("2026-10-14T00:01:00Z", 0),
      snap("2026-10-14T00:06:00Z", 0),
      snap("2026-10-14T00:12:00Z", 0),
    ];
    const [p] = goalProgress(snapshots, goals("2026-10-14T00:00:00Z"), new Date("2026-10-16T12:00:00Z"));
    expect(p?.status).toBe("too-early");
  });

  it("reports no-change for small moves", () => {
    const snapshots = [snap("2026-10-10T10:00:00Z", 5), snap("2026-10-15T10:00:00Z", 5), snap("2026-10-16T10:00:00Z", 5), snap("2026-10-17T10:00:00Z", 5)];
    const [p] = goalProgress(snapshots, goals("2026-10-14T00:00:00Z"), new Date("2026-10-17T12:00:00Z"));
    expect(p?.status).toBe("no-change");
  });
});

describe("whatToAsk", () => {
  it("lists the most frequent unsorted channels in the last 7 days", () => {
    const snapshots: Snapshot[] = [
      { takenAt: "2026-10-01T00:00:00Z", adsSkipped: 0, items: [item("old", "Qwerty", "Old Channel")] },
      { takenAt: "2026-10-19T00:00:00Z", adsSkipped: 0, items: [item("x1", "Qwerty one", "Mystery"), item("x2", "Qwerty two", "Mystery"), item("y1", "Zxcv", "Other"), item("f1", "Easy recipe", "Chef")] },
    ];
    const asks = whatToAsk(snapshots, EMPTY_COACH_DATA, new Date("2026-10-20T00:00:00Z"));
    expect(asks.map((a) => [a.channel, a.count])).toEqual([
      ["Mystery", 2],
      ["Other", 1],
    ]);
  });
});
