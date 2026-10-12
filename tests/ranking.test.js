import test from "node:test";
import assert from "node:assert/strict";
import { clusterMeasures, scale, rankClusters } from "../lib/ranking.js";

const vid = (o) => ({ channelId: "c1", views: 100, viewsPerHour: 10, likes: 5, comments: 5, isIndia: false, ...o });

test("scale maps to 0-1 and handles equal values", () => {
  assert.deepEqual(scale([10, 20, 30]), [0, 0.5, 1]);
  assert.deepEqual(scale([4, 4]), [0.5, 0.5]);
});

test("clusterMeasures: engagement ignores hidden values", () => {
  const m = clusterMeasures([
    vid({ views: 100, likes: 10, comments: 10 }),
    vid({ views: 900, likes: null, comments: null }),
  ]);
  assert.equal(m.engagement, 0.2); // 20 / 100
});

test("clusterMeasures: breadth, India opportunity and counts", () => {
  const m = clusterMeasures([
    vid({ channelId: "a", isIndia: true }),
    vid({ channelId: "b" }),
    vid({ channelId: "b" }),
    vid({ channelId: "c" }),
  ]);
  assert.equal(m.breadth, 3);
  assert.equal(m.indiaOpportunity, 0.75);
  assert.equal(m.indiaCount, 1);
  assert.equal(m.globalCount, 3);
});

test("rankClusters orders by score, drops null recurrence", () => {
  const strong = { measures: clusterMeasures([vid({ viewsPerHour: 100, views: 1000 })]) };
  const weak = { measures: clusterMeasures([vid({ viewsPerHour: 1, views: 10 })]) };
  const ranked = rankClusters([weak, strong]);
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[0].measures.views, 1000);
  assert.ok(ranked[0].score > ranked[1].score);
  assert.ok(ranked[0].score <= 1);
});

test("rankClusters uses recurrence when every cluster has it", () => {
  const a = { measures: clusterMeasures([vid()], 0) };
  const b = { measures: clusterMeasures([vid()], 6) };
  const ranked = rankClusters([a, b]);
  assert.equal(ranked[0].measures.recurrence, 6);
});
