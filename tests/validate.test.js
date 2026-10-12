import test from "node:test";
import assert from "node:assert/strict";
import { validateClusters, CLUSTER_TEXT_FIELDS } from "../lib/validate.js";

const known = new Set(["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"]);
const cluster = (ids) => {
  const c = { videoIds: ids };
  for (const f of CLUSTER_TEXT_FIELDS) c[f] = "text";
  return c;
};

test("accepts 3 good clusters and drops unknown ids", () => {
  const r = validateClusters({ clusters: [cluster(["v1", "v2", "zzz"]), cluster(["v3", "v4"]), cluster(["v5", "v6"])] }, known);
  assert.equal(r.ok, true);
  assert.deepEqual(r.clusters[0].videoIds, ["v1", "v2"]);
});

test("discards a cluster with fewer than 2 valid videos, then fails if under 3", () => {
  const r = validateClusters({ clusters: [cluster(["v1", "v2"]), cluster(["v3", "v4"]), cluster(["v5", "nope"])] }, known);
  assert.equal(r.ok, false);
});

test("a video can only be in one cluster", () => {
  const r = validateClusters({ clusters: [cluster(["v1", "v2"]), cluster(["v1", "v3", "v4"]), cluster(["v5", "v6"])] }, known);
  assert.equal(r.ok, true);
  assert.deepEqual(r.clusters[1].videoIds, ["v3", "v4"]);
});

test("rejects empty fields, bad shape and more than 5 clusters", () => {
  const bad = cluster(["v1", "v2"]);
  bad.trendName = " ";
  assert.equal(validateClusters({ clusters: [bad] }, known).ok, false);
  assert.equal(validateClusters({}, known).ok, false);
  const six = Array.from({ length: 6 }, () => cluster(["v1", "v2"]));
  assert.equal(validateClusters({ clusters: six }, known).ok, false);
});

test("relatedHistoryIds keeps only known history ids", () => {
  const c = cluster(["v1", "v2"]);
  c.relatedHistoryIds = ["h1", "h1", "unknown"];
  const r = validateClusters({ clusters: [c, cluster(["v3", "v4"]), cluster(["v5", "v6"])] }, known, new Set(["h1"]));
  assert.deepEqual(r.clusters[0].relatedHistoryIds, ["h1"]);
  assert.deepEqual(r.clusters[1].relatedHistoryIds, []);
});
