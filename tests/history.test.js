import test from "node:test";
import assert from "node:assert/strict";
import { weeklyCounts, recurrenceWeeks, assignLabel } from "../lib/history.js";

const DAY = 24 * 3600 * 1000;
const start = new Date("2026-06-01T00:00:00Z").getTime();
const daysBefore = (d) => new Date(start - d * DAY).toISOString();

test("weeklyCounts puts the nearest week last and ignores out-of-range dates", () => {
  const c = weeklyCounts([daysBefore(1), daysBefore(2), daysBefore(8), daysBefore(83), daysBefore(90), new Date(start + DAY).toISOString()], start);
  assert.equal(c.length, 12);
  assert.equal(c[11], 2); // week 0 (days 0-6 before)
  assert.equal(c[10], 1); // week 1
  assert.equal(c[0], 1); // week 11
  assert.equal(c.reduce((a, b) => a + b, 0), 4);
});

test("recurrenceWeeks counts weeks with at least one video", () => {
  assert.equal(recurrenceWeeks([0, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 3]), 3);
});

const none = new Array(12).fill(0);
const counts = (map) => none.map((_, i) => map[i] || 0);

test("New: fewer than 2 related videos", () => {
  assert.equal(assignLabel(none), "New");
  assert.equal(assignLabel(counts({ 11: 1 })), "New");
});

test("Returning: related videos existed but none in the last 4 weeks", () => {
  assert.equal(assignLabel(counts({ 2: 1, 3: 3 })), "Returning");
});

test("Recurring: 4 or more weeks with videos, including the last 4 weeks", () => {
  assert.equal(assignLabel(counts({ 1: 1, 3: 1, 6: 1, 10: 1 })), "Recurring");
});

test("Growing: everything else", () => {
  assert.equal(assignLabel(counts({ 10: 1, 11: 1 })), "Growing");
  assert.equal(assignLabel(counts({ 5: 1, 9: 2 })), "Growing"); // 2 weeks with videos, one inside the last 4 weeks
});

import { weekPieSlices } from "../lib/history.js";

test("weekPieSlices: one slice per week with videos, oldest first, shares add to 100%", () => {
  const counts = [0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]; // oldest -> newest
  const slices = weekPieSlices(counts);
  assert.deepEqual(slices.map((s) => [s.weeksAgo, s.count]), [[11, 2], [2, 1], [1, 1]]);
  assert.equal(slices[0].start, 0);
  assert.equal(slices[slices.length - 1].end, 100);
});

test("weekPieSlices: no related videos gives no slices", () => {
  assert.deepEqual(weekPieSlices(new Array(12).fill(0)), []);
});
