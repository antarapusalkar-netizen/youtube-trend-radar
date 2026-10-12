// Pure functions for history: weekly counts and the New / Returning / Recurring / Growing label.
import { HISTORY_WEEKS, NEW_MAX_RELATED, RECENT_WEEKS, RECURRING_MIN_WEEKS } from "./config.js";

const WEEK_MS = 7 * 24 * 3600 * 1000;

// Counts related historical videos per week, oldest week first.
// The last item is the week right before the current window. Dates outside the 12 weeks are ignored.
export function weeklyCounts(publishedDates, windowStart, weeks = HISTORY_WEEKS) {
  const counts = new Array(weeks).fill(0);
  for (const d of publishedDates) {
    const weeksBefore = Math.floor((windowStart - new Date(d).getTime()) / WEEK_MS);
    if (weeksBefore >= 0 && weeksBefore < weeks) counts[weeks - 1 - weeksBefore]++;
  }
  return counts;
}

// Number of past weeks the topic appeared in (used as "recurrence" in the ranking).
export function recurrenceWeeks(counts) {
  return counts.filter((c) => c > 0).length;
}

// Fixed rules, checked in this order. The label is decided by code, not by OpenAI.
export function assignLabel(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < NEW_MAX_RELATED) return "New";
  const recent = counts.slice(-RECENT_WEEKS).reduce((a, b) => a + b, 0);
  if (recent === 0) return "Returning";
  if (recurrenceWeeks(counts) >= RECURRING_MIN_WEEKS) return "Recurring";
  return "Growing";
}
