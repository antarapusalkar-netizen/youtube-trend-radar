import test from "node:test";
import assert from "node:assert/strict";
import { filterMinViews } from "../lib/process.js";
import { validateClusters, clusterFailureMessage, CLUSTER_TEXT_FIELDS, TOO_FEW_REASON } from "../lib/validate.js";
import { MIN_VIEWS } from "../lib/config.js";

test("MIN_VIEWS is 1,000", () => {
  assert.equal(MIN_VIEWS, 1000);
});

test("filterMinViews drops videos under 1,000 views and keeps 1,000 exactly", () => {
  const out = filterMinViews([{ id: "a", views: 999 }, { id: "b", views: 1000 }, { id: "c", views: 50000 }]);
  assert.deepEqual(out.map((v) => v.id), ["b", "c"]);
});

test("clusters can only use videos that passed the filter (others are unknown ids)", () => {
  const passed = new Set(["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9"]);
  const mk = (ids) => Object.fromEntries([["videoIds", ids], ...CLUSTER_TEXT_FIELDS.map((f) => [f, "text"])]);
  // low-view videos (lowA, lowB) were dropped before clustering, so they do not count toward the 3
  const r = validateClusters({ clusters: [mk(["v1", "v2", "lowA"]), mk(["v4", "v5", "v6"]), mk(["v7", "v8", "v9"])] }, passed);
  assert.equal(r.ok, false);
  assert.equal(r.reason, TOO_FEW_REASON);
});

test("fewer than 3 clusters gives a clear message, other failures keep the generic one", () => {
  assert.match(clusterFailureMessage(TOO_FEW_REASON), /Not enough clear trends this week/);
  assert.match(clusterFailureMessage(TOO_FEW_REASON), /1,000 views/);
  assert.match(clusterFailureMessage("no clusters array"), /did not return a valid result/);
});
