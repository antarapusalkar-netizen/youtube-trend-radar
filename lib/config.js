// All fixed numbers and lists live here, so they are easy to find and explain.

// How many days back the main "what is happening now" analysis looks.
export const WINDOW_DAYS = 7;

// Generate Now can only run once every 5 minutes.
export const RATE_LIMIT_MINUTES = 5;

// YouTube search settings (7-day search).
export const SEARCH_MAX_RESULTS = 15;
export const MIN_VIDEOS_AFTER_CLEANING = 10;
export const MAX_VIDEOS_FOR_OPENAI = 80;
export const SHORTS_MAX_SECONDS = 60; // videos under 60s are Shorts

// Between 3 and 5 categories at a time.
export const MIN_CATEGORIES = 3;
export const MAX_CATEGORIES = 5;

// Number of clusters OpenAI must return.
export const MIN_CLUSTERS = 3;
export const MAX_CLUSTERS = 5;
export const MIN_VIDEOS_PER_CLUSTER = 2;

// Ranking weights (percent). Layer 2 fills in "recurrence".
export const WEIGHTS = {
  momentum: 30,
  engagement: 20,
  breadth: 15,
  recurrence: 15,
  indiaOpportunity: 15,
  views: 5,
};

export const DEFAULT_REGION = "IN";

export const REGIONS = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "UAE" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "BR", name: "Brazil" },
];

export const DEFAULT_CATEGORIES = [
  "New AI Tools and Launches",
  "AI Tool How-To and Education",
  "Productivity Apps and Workflows",
  "AI Changing Existing Work",
  "Emerging AI Trends and Use Cases",
];

// ---- 90-day history (Layer 2) ----
export const HISTORY_DAYS = 90;
export const HISTORY_WEEKS = 12; // weeks of history used for matching and labels
export const HISTORY_SEARCH_RESULTS = 50;
export const MAX_HISTORY_TITLES = 150; // titles sent to OpenAI for matching

// Label rules, checked in this order: New, Returning, Recurring, Growing.
export const NEW_MAX_RELATED = 2; // New: fewer than 2 related historical videos in total
export const RECENT_WEEKS = 4; // "the 4 weeks before the current window"
export const RECURRING_MIN_WEEKS = 4; // Recurring: related videos in at least 4 of the last 12 weeks
