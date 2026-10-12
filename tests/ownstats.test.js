import test from "node:test";
import assert from "node:assert/strict";
import { analyticsRange, rowsToObjects, hasEnoughData } from "../lib/ownstats.js";

test("analyticsRange ends 2 days ago and covers 7 days", () => {
  const r = analyticsRange(new Date("2026-06-10T12:00:00Z").getTime());
  assert.deepEqual(r, { startDate: "2026-06-02", endDate: "2026-06-08" });
});

test("rowsToObjects pairs headers with values", () => {
  const out = rowsToObjects([{ name: "video" }, { name: "views" }], [["a", 5], ["b", 7]]);
  assert.deepEqual(out, [{ video: "a", views: 5 }, { video: "b", views: 7 }]);
  assert.deepEqual(rowsToObjects(undefined, undefined), []);
});

test("hasEnoughData needs 3 videos with views", () => {
  assert.equal(hasEnoughData([{ views: 1 }, { views: 2 }]), false);
  assert.equal(hasEnoughData([{ views: 1 }, { views: 2 }, { views: 0 }]), false);
  assert.equal(hasEnoughData([{ views: 1 }, { views: 2 }, { views: 3 }]), true);
});
