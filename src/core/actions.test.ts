import { describe, expect, it } from "vitest";
import {
  addAction,
  computeBaseline,
  evaluateAction,
  finalizeAction,
  isUndoLabel,
  lessTip,
  makeAction,
  matchMenuLabel,
  summarize,
  undoLatest,
  type ActionResult,
} from "./actions";
import type { FeedbackAction, FeedItem, Snapshot } from "./types";

const item = (videoId: string, channel: string | null, title = "A video"): FeedItem => ({ position: 0, kind: "video", videoId, title, channel, channelUrl: null });
const visit = (takenAt: string, ...items: FeedItem[]): Snapshot => ({ takenAt, adsSkipped: 0, items: items.length ? items : [item("filler", "Other")] });
const AT = "2026-10-20T10:00:00Z";
const hoursAfter = (h: number) => new Date(Date.parse(AT) + h * 3600 * 1000).toISOString();

describe("matchMenuLabel", () => {
  it("recognises YouTube's menu labels, whatever the apostrophe or case", () => {
    expect(matchMenuLabel("Don't recommend channel")).toBe("dont-recommend-channel");
    expect(matchMenuLabel("Don’t recommend channel")).toBe("dont-recommend-channel");
    expect(matchMenuLabel("  Not interested ")).toBe("not-interested");
    expect(matchMenuLabel("Ça ne m'intéresse pas")).toBe("not-interested");
    expect(matchMenuLabel("Kanal nicht empfehlen")).toBe("dont-recommend-channel");
  });

  it("ignores other menu items", () => {
    expect(matchMenuLabel("Add to queue")).toBeNull();
    expect(matchMenuLabel("Report")).toBeNull();
    expect(matchMenuLabel("")).toBeNull();
  });

  it("recognises Undo", () => {
    expect(isUndoLabel("UNDO")).toBe(true);
    expect(isUndoLabel("Rückgängig machen")).toBe(true);
    expect(isUndoLabel("Tell us why")).toBe(false);
  });
});

describe("addAction and undoLatest", () => {
  const a = makeAction("not-interested", item("v1", "Gist Central"), AT, "detected");

  it("adds actions and skips detected duplicates within 10 minutes", () => {
    const one = addAction([], a)!;
    expect(one).toHaveLength(1);
    expect(addAction(one, makeAction("not-interested", item("v1", "Gist Central"), hoursAfter(0.08), "detected"))).toBeNull();
    expect(addAction(one, makeAction("dont-recommend-channel", item("v1", "Gist Central"), hoursAfter(0.08), "detected"))).toHaveLength(2);
    expect(addAction(one, makeAction("not-interested", item("v1", "Gist Central"), hoursAfter(1), "detected"))).toHaveLength(2);
  });

  it("ignores a hand report of an action already recorded, however long ago", () => {
    // Found in review: a manual report an hour later was counted twice.
    const one = addAction([], a)!;
    expect(addAction(one, makeAction("not-interested", item("v1", "Gist Central"), hoursAfter(30), "manual"))).toBeNull();
  });

  it("undoes only the matching video's action within 2 minutes", () => {
    // Found in review: Undo on A's card used to undo the later action on B.
    const onA = makeAction("not-interested", item("vA", "X"), AT, "detected");
    const onB = makeAction("not-interested", item("vB", "Y"), hoursAfter(0.01), "detected");
    const undone = undoLatest([onA, onB], hoursAfter(0.02), "vA")!;
    expect(undone.map((x) => x.undone ?? false)).toEqual([true, false]);
    expect(undoLatest([onA, onB], hoursAfter(0.05), "vA")).toBeNull(); // 3 minutes later
    expect(undoLatest([onA, onB], hoursAfter(0.02), "vZ")).toBeNull();
  });
});

describe("computeBaseline", () => {
  it("counts earlier visits, skips the same visit, and always counts the action's own visit", () => {
    const snapshots = [
      visit("2026-10-12T10:00:00Z", item("old", "Gist Central")), // more than 7 days before: ignored
      visit("2026-10-19T10:00:00Z", item("g1", "Gist Central")),
      visit("2026-10-19T20:00:00Z", item("x", "Other")),
      visit("2026-10-20T09:58:00Z", item("v1", "Gist Central")), // same visit (2 minutes before): ignored
    ];
    expect(computeBaseline("Gist Central", AT, snapshots)).toEqual({ visits: 3, channelVisits: 2 });
  });
});

describe("evaluateAction", () => {
  const gist = (id = "g") => item(id, "Gist Central");
  const before = [visit("2026-10-19T10:00:00Z", gist()), visit("2026-10-19T20:00:00Z", gist()), visit("2026-10-20T09:00:00Z", gist("v1"))];
  const action = (kind: FeedbackAction["kind"], channel: string | null = "Gist Central", earlier: Snapshot[] = before) =>
    makeAction(kind, item("v1", channel), AT, "detected", earlier);
  const later = (count: number, withGist: (i: number) => boolean, videoBack = false) =>
    Array.from({ length: count }, (_, i) => {
      const items = [item(`o${i}`, "Other")];
      if (withGist(i)) items.push(gist(`n${i}`));
      if (videoBack && i === 0) items.push(gist("v1"));
      return visit(hoursAfter(2.4 + i * 14.4), ...items);
    });

  it("is measuring until 5 visits reach 2 days after the action", () => {
    expect(evaluateAction(action("dont-recommend-channel"), [...before, ...later(4, () => false)]).status).toBe("measuring");
    const sameDay = Array.from({ length: 6 }, (_, i) => visit(hoursAfter(1 + i)));
    expect(evaluateAction(action("dont-recommend-channel"), [...before, ...sameDay]).status).toBe("measuring");
  });

  it("doesn't count a snapshot from the same visit as a later visit", () => {
    const sameVisit = visit(hoursAfter(0.05), gist("v1"));
    const r = evaluateAction(action("not-interested"), [...before, sameVisit, ...later(5, () => false)]);
    expect(r.visitsAfter).toBe(5);
    expect(r.videoCameBack).toBe(false);
  });

  it("Don't recommend channel worked when the channel never returns", () => {
    const r = evaluateAction(action("dont-recommend-channel"), [...before, ...later(5, () => false)]);
    expect(r).toMatchObject({ status: "worked", beforeRate: 1, afterRate: 0, noBaseline: false });
  });

  it("Don't recommend channel partly worked when the channel shows half as often or less", () => {
    expect(evaluateAction(action("dont-recommend-channel"), [...before, ...later(6, (i) => i === 0)]).status).toBe("partly");
  });

  it("Don't recommend channel didn't work when the channel keeps showing", () => {
    expect(evaluateAction(action("dont-recommend-channel"), [...before, ...later(6, () => true)]).status).toBe("didnt-work");
  });

  it("without enough earlier visits, never claims 'halved'", () => {
    // Found in review: with no earlier data the 'before' share defaulted to 100%.
    const noHistory = action("dont-recommend-channel", "Gist Central", []);
    const r = evaluateAction(noHistory, later(6, (i) => i === 0));
    expect(r).toMatchObject({ noBaseline: true, beforeRate: null, status: "didnt-work" });
    expect(evaluateAction(noHistory, later(6, () => false)).status).toBe("worked");
  });

  it("Not interested didn't work if the same video came back", () => {
    expect(evaluateAction(action("not-interested"), [...before, ...later(5, () => false, true)]).status).toBe("didnt-work");
  });

  it("Not interested worked when the video is gone and the channel shows half as often", () => {
    expect(evaluateAction(action("not-interested"), [...before, ...later(6, (i) => i < 2)]).status).toBe("worked");
  });

  it("Not interested partly worked when the video is gone but the channel still shows", () => {
    expect(evaluateAction(action("not-interested"), [...before, ...later(6, () => true)]).status).toBe("partly");
  });

  it("reports undone actions as undone", () => {
    expect(evaluateAction({ ...action("not-interested"), undone: true }, [...before, ...later(6, () => false)]).status).toBe("undone");
  });

  it("can't check Don't recommend channel without a channel name", () => {
    expect(evaluateAction(action("dont-recommend-channel", null), [...before, ...later(6, () => false)]).status).toBe("cant-check");
  });

  it("judges Not interested without a channel name by the video alone", () => {
    const r = evaluateAction(action("not-interested", null), [...before, ...later(5, () => false)]);
    expect(r).toMatchObject({ status: "worked", afterRate: null });
  });

  it("only uses visits in the 2 weeks after the action", () => {
    const a = action("dont-recommend-channel");
    const inWindow = later(5, () => false);
    const muchLater = [visit("2026-11-10T10:00:00Z", gist("late"))];
    expect(evaluateAction(a, [...before, ...inWindow, ...muchLater]).status).toBe("worked");
  });

  it("keeps the same 'before' even after old snapshots are trimmed", () => {
    // Found in review: trimming old snapshots changed the before share and flipped verdicts.
    const a = action("dont-recommend-channel");
    const afterVisits = later(6, (i) => i === 0);
    expect(evaluateAction(a, [...before, ...afterVisits]).beforeRate).toBe(1);
    expect(evaluateAction(a, afterVisits).beforeRate).toBe(1);
    expect(evaluateAction(a, afterVisits).status).toBe("partly");
  });
});

describe("finalizeAction", () => {
  const before = [visit("2026-10-19T10:00:00Z", item("g", "Gist Central")), visit("2026-10-19T20:00:00Z"), visit("2026-10-20T08:00:00Z")];
  const a = makeAction("dont-recommend-channel", item("v1", "Gist Central"), AT, "detected", before);
  const afterVisits = Array.from({ length: 5 }, (_, i) => visit(hoursAfter(10 + i * 12)));

  it("does nothing while the 2-week window is open", () => {
    expect(finalizeAction(a, [...before, ...afterVisits], hoursAfter(24 * 13))).toBeNull();
  });

  it("freezes the verdict once the window closes, and it stays when snapshots are gone", () => {
    const frozen = finalizeAction(a, [...before, ...afterVisits], hoursAfter(24 * 15))!;
    expect(frozen.final?.status).toBe("worked");
    expect(evaluateAction(frozen, []).status).toBe("worked");
    expect(finalizeAction(frozen, [], hoursAfter(24 * 30))).toBeNull();
  });

  it("marks actions without enough visits as no-data", () => {
    expect(finalizeAction(a, before, hoursAfter(24 * 15))?.final?.status).toBe("no-data");
  });
});

describe("summarize and lessTip", () => {
  const result = (kind: FeedbackAction["kind"], status: ActionResult["status"]): ActionResult => ({
    action: makeAction(kind, item("v", "C"), AT, "detected"),
    status,
    beforeRate: 1,
    afterRate: 0,
    visitsAfter: 5,
    videoCameBack: false,
    noBaseline: false,
  });

  it("counts results per button, ignoring can't-check and no-data", () => {
    const [drc, ni] = summarize([
      result("dont-recommend-channel", "worked"),
      result("dont-recommend-channel", "measuring"),
      result("dont-recommend-channel", "cant-check"),
      result("not-interested", "didnt-work"),
      result("not-interested", "no-data"),
    ]);
    expect(drc).toMatchObject({ worked: 1, measuring: 1, judged: 1 });
    expect(ni).toMatchObject({ didntWork: 1, judged: 1 });
  });

  it("uses general advice until there are 3 judged actions", () => {
    expect(lessTip(summarize([result("not-interested", "worked")]))).toBe("Less of this: ⋮ menu → Don't recommend channel");
  });

  it("recommends the button that worked best for this user", () => {
    const results = [
      ...Array.from({ length: 3 }, () => result("not-interested", "worked")),
      result("dont-recommend-channel", "didnt-work"),
      result("dont-recommend-channel", "didnt-work"),
      result("dont-recommend-channel", "partly"),
    ];
    expect(lessTip(summarize(results))).toBe("Less of this: ⋮ menu → Not interested (worked 3 of 3 times for you)");
  });
});
