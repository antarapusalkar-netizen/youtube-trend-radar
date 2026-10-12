import test from "node:test";
import assert from "node:assert/strict";
import { validateClusters, saysNoIndia, CLUSTER_TEXT_FIELDS } from "../lib/validate.js";
import { CLUSTER_PROMPT } from "../lib/openai.js";

const known = new Set(["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10"]);
const cluster = (ids, extra = {}) => {
  const c = { videoIds: ids };
  for (const f of CLUSTER_TEXT_FIELDS) c[f] = "text";
  return { ...c, ...extra };
};
const three = () => [cluster(["v1", "v2", "v3"]), cluster(["v4", "v5", "v6"]), cluster(["v7", "v8", "v9"])];

test("accepts 3 good clusters and drops unknown ids", () => {
  const r = validateClusters({ clusters: [cluster(["v1", "v2", "v3", "zzz"]), ...three().slice(1)] }, known);
  assert.equal(r.ok, true);
  assert.deepEqual(r.clusters[0].videoIds, ["v1", "v2", "v3"]);
});

test("a cluster needs at least 3 valid videos", () => {
  // 2-video cluster is discarded, leaving only 2 clusters -> invalid
  const r = validateClusters({ clusters: [cluster(["v1", "v2"]), cluster(["v4", "v5", "v6"]), cluster(["v7", "v8", "v9"])] }, known);
  assert.equal(r.ok, false);
  // unknown ids do not count toward the 3
  const r2 = validateClusters({ clusters: [cluster(["v1", "v2", "nope"]), ...three().slice(1)] }, known);
  assert.equal(r2.ok, false);
});

test("a video can only be in one cluster", () => {
  const r = validateClusters({ clusters: [cluster(["v1", "v2", "v3"]), cluster(["v1", "v4", "v5", "v6"]), cluster(["v7", "v8", "v9"])] }, known);
  assert.equal(r.ok, true);
  assert.deepEqual(r.clusters[1].videoIds, ["v4", "v5", "v6"]);
});

test("videos left out of every cluster are fine (e.g. not about AI or tech)", () => {
  const r = validateClusters({ clusters: three() }, known); // v10 is in no cluster
  assert.equal(r.ok, true);
  assert.equal(r.clusters.flatMap((c) => c.videoIds).includes("v10"), false);
});

test("the prompt requires specific clusters with good and bad examples", () => {
  assert.match(CLUSTER_PROMPT, /What specific thing are multiple creators talking about right now\?/);
  assert.match(CLUSTER_PROMPT, /Good: "AI is changing software engineering roles"/);
  assert.match(CLUSTER_PROMPT, /Bad: "How AI is changing jobs"/);
  assert.match(CLUSTER_PROMPT, /Bad: "AI content"/);
});

test("the prompt requires clusters to be clearly different from each other", () => {
  assert.match(CLUSTER_PROMPT, /Clusters must be clearly different from each other/);
  assert.match(CLUSTER_PROMPT, /Do not split one topic into several overlapping clusters/);
});

test("the prompt asks for up to 5 clusters", () => {
  assert.match(CLUSTER_PROMPT, /up to 5 trend clusters \(never fewer than 3\)/);
});

test("the prompt tells OpenAI to leave out non-AI/tech videos and to use 3+ videos on one topic", () => {
  assert.match(CLUSTER_PROMPT, /at least 3 videos about the SAME specific topic/);
  assert.match(CLUSTER_PROMPT, /Leave out videos that are not about AI or tech/);
  assert.match(CLUSTER_PROMPT, /isIndia/);
});

test("rejects empty fields, bad shape and more than 5 clusters", () => {
  const bad = cluster(["v1", "v2", "v3"]);
  bad.trendName = " ";
  assert.equal(validateClusters({ clusters: [bad] }, known).ok, false);
  assert.equal(validateClusters({}, known).ok, false);
  const six = Array.from({ length: 6 }, () => cluster(["v1", "v2", "v3"]));
  assert.equal(validateClusters({ clusters: six }, known).ok, false);
});

test("relatedHistoryIds keeps only known history ids", () => {
  const list = three();
  list[0].relatedHistoryIds = ["h1", "h1", "unknown"];
  const r = validateClusters({ clusters: list }, known, new Set(["h1"]));
  assert.deepEqual(r.clusters[0].relatedHistoryIds, ["h1"]);
  assert.deepEqual(r.clusters[1].relatedHistoryIds, []);
});

test("saysNoIndia catches 'no India' wording but not harmless text", () => {
  assert.equal(saysNoIndia("None of these videos are India-based."), true);
  assert.equal(saysNoIndia("The data does not show an India-based creator."), true);
  assert.equal(saysNoIndia("There are no Indian creators here."), true);
  assert.equal(saysNoIndia("Two videos come from India-based channels."), false);
  assert.equal(saysNoIndia("The topic is not only popular in India."), false);
});

test("India context contradicting coded India videos makes the answer invalid", () => {
  const videoInfo = new Map([["v1", { isIndia: true }], ["v2", { isIndia: false }], ["v3", { isIndia: false }]]);
  const list = three();
  list[0].indiaContext = "None of these videos are India-based.";
  assert.equal(validateClusters({ clusters: list }, known, new Set(), videoInfo).ok, false);

  // same text is fine when the code counted no India videos
  const noIndia = new Map([["v1", { isIndia: false }]]);
  assert.equal(validateClusters({ clusters: list }, known, new Set(), noIndia).ok, true);

  // honest text with India videos is fine
  list[0].indiaContext = "One video comes from an India-based channel.";
  assert.equal(validateClusters({ clusters: list }, known, new Set(), videoInfo).ok, true);
});
