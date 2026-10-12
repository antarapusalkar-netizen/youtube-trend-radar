// Pure data-processing functions (no network, no database). Easy to unit test.
import { SHORTS_MAX_SECONDS, MAX_VIDEOS_FOR_OPENAI } from "./config.js";

// "PT1H2M3S" -> 3723 seconds. Returns 0 if it cannot be read.
export function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x || 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

// Videos under 60 seconds are Shorts.
export function isShort(durationSeconds) {
  return durationSeconds < SHORTS_MAX_SECONDS;
}

// Hours since upload, never less than 1 (avoids dividing by tiny numbers).
export function hoursOld(publishedAt, now = Date.now()) {
  return Math.max(1, (now - new Date(publishedAt).getTime()) / 3600000);
}

export function viewsPerHour(views, publishedAt, now = Date.now()) {
  return views / hoursOld(publishedAt, now);
}

// Hidden likes/comments come back missing: treat them as null.
export function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Remove duplicates and Shorts, add viewsPerHour and the India flag.
// A video is an "India video" ONLY if its channel country is exactly IN (the search region proves nothing).
export function cleanVideos(videos, now = Date.now()) {
  const seen = new Set();
  const result = [];
  for (const v of videos) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    if (isShort(v.durationSeconds)) continue;
    result.push({
      ...v,
      hoursOld: hoursOld(v.publishedAt, now),
      viewsPerHour: viewsPerHour(v.views, v.publishedAt, now),
      isIndia: v.channelCountry === "IN",
    });
  }
  return result;
}

// Keep only the fastest-growing videos so the OpenAI request stays small.
export function topByViewsPerHour(videos, limit = MAX_VIDEOS_FOR_OPENAI) {
  return [...videos].sort((a, b) => b.viewsPerHour - a.viewsPerHour).slice(0, limit);
}
