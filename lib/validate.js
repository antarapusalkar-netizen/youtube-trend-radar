// Checks what OpenAI returned. Pure function, so it is easy to test.
import { MIN_CLUSTERS, MAX_CLUSTERS, MIN_VIDEOS_PER_CLUSTER } from "./config.js";

export const CLUSTER_TEXT_FIELDS = [
  "trendName",
  "whatIsHappening",
  "whyItMattersNow",
  "whatCreatorsAreDoing",
  "formatsUsed",
  "engagementSignals",
  "globalContext",
  "indiaContext",
  "opportunityForIshaan",
  "suggestedContentAngle",
];

// Returns { ok: true, clusters } or { ok: false, reason }.
export function validateClusters(parsed, knownIds) {
  if (!parsed || !Array.isArray(parsed.clusters)) return { ok: false, reason: "no clusters array" };
  if (parsed.clusters.length > MAX_CLUSTERS) return { ok: false, reason: "too many clusters" };

  const used = new Set();
  const clusters = [];
  for (const c of parsed.clusters) {
    if (!c || typeof c !== "object") continue;
    const allFilled = CLUSTER_TEXT_FIELDS.every((f) => typeof c[f] === "string" && c[f].trim() !== "");
    if (!allFilled || !Array.isArray(c.videoIds)) return { ok: false, reason: "a cluster has empty fields" };

    // Keep known ids only, and each video in at most one cluster.
    const ids = [];
    for (const id of c.videoIds) {
      if (knownIds.has(id) && !used.has(id) && !ids.includes(id)) ids.push(id);
    }
    if (ids.length < MIN_VIDEOS_PER_CLUSTER) continue; // discard weak cluster
    ids.forEach((id) => used.add(id));

    const clean = { videoIds: ids };
    for (const f of CLUSTER_TEXT_FIELDS) clean[f] = c[f].trim();
    clusters.push(clean);
  }

  if (clusters.length < MIN_CLUSTERS) return { ok: false, reason: "fewer than 3 valid clusters" };
  return { ok: true, clusters };
}
