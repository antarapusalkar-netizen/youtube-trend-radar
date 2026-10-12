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

// Phrases that say "no India-based videos". Not allowed when the code counted India videos.
const NO_INDIA_PATTERNS = [
  /\b(none|no|not|zero|without|neither|nor|lack|lacks|absent|missing)\b(?!\s+only)[^.]{0,60}\b(india|indian)\b/i,
  /\b(india|indian)[^.]{0,40}\b(absent|missing|not (shown|identified|present|covered))\b/i,
];

// True if the India text says there are no India videos.
export function saysNoIndia(text) {
  return NO_INDIA_PATTERNS.some((p) => p.test(text));
}

// Returns { ok: true, clusters } or { ok: false, reason }.
// videoInfo (optional) is a Map: video id -> { isIndia }. Used to check the India context against the coded counts.
export function validateClusters(parsed, knownIds, historyIds = new Set(), videoInfo = new Map()) {
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

    // The India context must not contradict the coded India count.
    const indiaVideos = ids.filter((id) => videoInfo.get(id) && videoInfo.get(id).isIndia).length;
    if (indiaVideos > 0 && saysNoIndia(c.indiaContext)) return { ok: false, reason: "India context contradicts the coded India videos" };

    // Related history ids are optional: keep only ids we sent, no duplicates.
    const related = Array.isArray(c.relatedHistoryIds) ? c.relatedHistoryIds : [];
    const clean = { videoIds: ids, relatedHistoryIds: [...new Set(related.filter((id) => historyIds.has(id)))] };
    for (const f of CLUSTER_TEXT_FIELDS) clean[f] = c[f].trim();
    clusters.push(clean);
  }

  if (clusters.length < MIN_CLUSTERS) return { ok: false, reason: "fewer than 3 valid clusters" };
  return { ok: true, clusters };
}
