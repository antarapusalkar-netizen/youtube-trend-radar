// Pure helpers for Ishaan's own analytics (no network).
import { OWN_MIN_VIDEOS, OWN_LAG_DAYS } from "./config.js";

const DAY = 24 * 3600 * 1000;
const dateText = (ms) => new Date(ms).toISOString().slice(0, 10);

// Last 7 days, ending 2 days ago (analytics data lags). Returns { startDate, endDate }.
export function analyticsRange(now = Date.now()) {
  const end = now - OWN_LAG_DAYS * DAY;
  return { startDate: dateText(end - 6 * DAY), endDate: dateText(end) };
}

// Analytics returns columnHeaders + rows of numbers. Turn each row into { name: value }.
export function rowsToObjects(columnHeaders, rows) {
  const names = (columnHeaders || []).map((h) => h.name);
  return (rows || []).map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
}

// Need at least 3 videos with views, otherwise show "Not enough data".
export function hasEnoughData(videos) {
  return videos.filter((v) => v.views > 0).length >= OWN_MIN_VIDEOS;
}
