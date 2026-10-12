// Code-based ranking of clusters. OpenAI never decides the order.
import { WEIGHTS } from "./config.js";

// Measures for one cluster, calculated from its videos.
// recurrence = number of past weeks the topic appeared in (null until Layer 2).
export function clusterMeasures(videos, recurrence = null) {
  const total = videos.length;
  const indiaCount = videos.filter((v) => v.isIndia).length;

  // Engagement: skip videos where both likes and comments are hidden.
  let interactions = 0;
  let viewsWithData = 0;
  for (const v of videos) {
    if (v.likes === null && v.comments === null) continue;
    interactions += (v.likes || 0) + (v.comments || 0);
    viewsWithData += v.views;
  }

  return {
    momentum: videos.reduce((sum, v) => sum + v.viewsPerHour, 0),
    engagement: viewsWithData > 0 ? interactions / viewsWithData : 0,
    breadth: new Set(videos.map((v) => v.channelId)).size,
    views: videos.reduce((sum, v) => sum + v.views, 0),
    indiaOpportunity: total > 0 ? 1 - indiaCount / total : 0,
    recurrence,
    indiaCount,
    globalCount: total - indiaCount,
  };
}

// Scale numbers to 0-1 (smallest = 0, largest = 1). If all are equal, everyone gets 0.5.
export function scale(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

// Adds score and rank to each cluster, highest score first.
// A measure that is null for every cluster is dropped and the other weights are re-scaled to 100%.
export function rankClusters(clusters) {
  const keys = Object.keys(WEIGHTS).filter((k) =>
    clusters.every((c) => c.measures[k] !== null && c.measures[k] !== undefined)
  );
  const weightTotal = keys.reduce((sum, k) => sum + WEIGHTS[k], 0);

  const scaled = {};
  for (const k of keys) scaled[k] = scale(clusters.map((c) => c.measures[k]));

  const scored = clusters.map((c, i) => {
    let score = 0;
    for (const k of keys) score += (WEIGHTS[k] / weightTotal) * scaled[k][i];
    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((c, i) => ({ ...c, rank: i + 1 }));
}
