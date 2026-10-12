// Tiny made-up inputs, used only here. The app itself never contains sample data.
import test from "node:test";
import assert from "node:assert/strict";
import { parseDuration, isShort, viewsPerHour, cleanVideos, topByViewsPerHour, toNumberOrNull } from "../lib/process.js";

test("parseDuration reads ISO durations", () => {
  assert.equal(parseDuration("PT45S"), 45);
  assert.equal(parseDuration("PT10M"), 600);
  assert.equal(parseDuration("PT1H2M3S"), 3723);
  assert.equal(parseDuration("bad"), 0);
});

test("isShort: under 60 seconds only", () => {
  assert.equal(isShort(59), true);
  assert.equal(isShort(60), false);
});

test("viewsPerHour uses a minimum of 1 hour", () => {
  const now = new Date("2026-01-02T00:00:00Z").getTime();
  assert.equal(viewsPerHour(1000, "2026-01-01T00:00:00Z", now), 1000 / 24);
  assert.equal(viewsPerHour(500, "2026-01-01T23:59:00Z", now), 500);
});

test("toNumberOrNull handles hidden values", () => {
  assert.equal(toNumberOrNull(undefined), null);
  assert.equal(toNumberOrNull("12"), 12);
});

test("cleanVideos removes duplicates and Shorts; isIndia only when channel country is IN", () => {
  const now = new Date("2026-01-02T00:00:00Z").getTime();
  const base = { publishedAt: "2026-01-01T00:00:00Z", views: 240, durationSeconds: 300 };
  const out = cleanVideos(
    [
      { ...base, id: "a", source: "global", channelCountry: null },
      { ...base, id: "a", source: "global", channelCountry: null },
      { ...base, id: "b", source: "global", channelCountry: "IN" },
      { ...base, id: "c", source: "region", channelCountry: null }, // region search is NOT proof of India
      { ...base, id: "e", source: "region", channelCountry: "US" },
      { ...base, id: "d", source: "global", channelCountry: "US", durationSeconds: 30 },
    ],
    now
  );
  assert.deepEqual(out.map((v) => v.id), ["a", "b", "c", "e"]);
  assert.deepEqual(out.map((v) => v.isIndia), [false, true, false, false]);
});

test("topByViewsPerHour keeps the fastest videos", () => {
  const out = topByViewsPerHour([{ viewsPerHour: 1 }, { viewsPerHour: 9 }, { viewsPerHour: 5 }], 2);
  assert.deepEqual(out.map((v) => v.viewsPerHour), [9, 5]);
});
