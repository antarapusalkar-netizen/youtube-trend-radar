import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchParams } from "../lib/ytsearch.js";

const opts = { after: "2026-01-01T00:00:00Z", before: undefined, max: 30 };

test("global search: English hint, most-viewed, no region code", () => {
  const p = buildSearchParams("AI tools", { ...opts, regionCode: undefined });
  assert.equal(p.relevanceLanguage, "en");
  assert.equal(p.order, "viewCount");
  assert.equal(p.q, "AI tools");
  assert.equal(p.maxResults, 30);
  assert.equal(p.regionCode, undefined);
});

test("region search keeps the region code and also uses the English hint", () => {
  const p = buildSearchParams("AI tools", { ...opts, regionCode: "IN" });
  assert.equal(p.regionCode, "IN");
  assert.equal(p.relevanceLanguage, "en");
});
