import { describe, expect, it } from "vitest";
import { addSnapshot, MAX_SNAPSHOTS } from "./snapshots";
import type { Snapshot } from "./types";

const item = { position: 0, kind: "video" as const, videoId: "v1", title: "A video", channel: "C", channelUrl: null };
const snap = (takenAt: string, items = [item]): Snapshot => ({ takenAt, items, adsSkipped: 0 });

describe("addSnapshot", () => {
  it("adds the first snapshot", () => {
    expect(addSnapshot([], snap("2026-10-21T10:00:00Z"))).toHaveLength(1);
  });

  it("skips snapshots taken less than 5 minutes after the last one", () => {
    const first = [snap("2026-10-21T10:00:00Z")];
    expect(addSnapshot(first, snap("2026-10-21T10:04:59Z"))).toBeNull();
    expect(addSnapshot(first, snap("2026-10-21T10:05:00Z"))).toHaveLength(2);
  });

  it("skips empty snapshots", () => {
    expect(addSnapshot([], snap("2026-10-21T10:00:00Z", []))).toBeNull();
  });

  it("keeps only the newest snapshots when full", () => {
    const full = Array.from({ length: MAX_SNAPSHOTS }, (_, i) => snap(new Date(Date.UTC(2026, 0, 1, 0, i * 10)).toISOString()));
    const result = addSnapshot(full, snap("2027-01-01T00:00:00Z"));
    expect(result).toHaveLength(MAX_SNAPSHOTS);
    expect(result?.at(-1)?.takenAt).toBe("2027-01-01T00:00:00Z");
    expect(result?.[0]?.takenAt).toBe(full[1]?.takenAt);
  });
});
