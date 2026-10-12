// Talks to the YouTube Data API. Each search costs 100 quota units.
import { UserError, requireEnv } from "./errors.js";
import { SEARCH_MAX_RESULTS, HISTORY_SEARCH_RESULTS } from "./config.js";
import { youtubeErrorMessage } from "./ytErrors.js";
import { buildSearchParams } from "./ytsearch.js";
import { parseDuration, toNumberOrNull, isShort } from "./process.js";

const BASE = "https://www.googleapis.com/youtube/v3";

// One GET call. Errors become friendly messages (the key is never shown).
async function callYouTube(endpoint, params) {
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY);

  let res;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    throw new UserError("Could not reach YouTube. Check the internet connection and try again.");
  }
  if (res.ok) return res.json();

  let reason = "";
  try {
    reason = (await res.json()).error.errors[0].reason;
  } catch {}
  throw new UserError(youtubeErrorMessage(res.status, reason));
}

// Search once. regionCode is left out for the global search.
async function searchIds(query, { after, before, max, regionCode }) {
  const data = await callYouTube("search", buildSearchParams(query, { after, before, max, regionCode }));
  return (data.items || []).map((i) => i.id && i.id.videoId).filter(Boolean);
}

function chunks(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// videos.list in batches of 50. Returns a plain list of video objects.
export async function fetchVideoDetails(ids) {
  const videos = [];
  for (const batch of chunks(ids, 50)) {
    const data = await callYouTube("videos", { part: "snippet,contentDetails,statistics", id: batch.join(",") });
    for (const item of data.items || []) {
      videos.push({
        id: item.id,
        title: item.snippet.title,
        channelId: item.snippet.channelId,
        channelName: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        views: toNumberOrNull(item.statistics && item.statistics.viewCount) || 0,
        likes: toNumberOrNull(item.statistics && item.statistics.likeCount),
        comments: toNumberOrNull(item.statistics && item.statistics.commentCount),
        durationSeconds: parseDuration(item.contentDetails && item.contentDetails.duration),
        tags: item.snippet.tags || [],
      });
    }
  }
  return videos;
}

// channels.list (part=snippet) in batches of 50 -> { channelId: country or null }.
export async function fetchChannelCountries(channelIds) {
  const countries = {};
  for (const batch of chunks([...new Set(channelIds)], 50)) {
    const data = await callYouTube("channels", { part: "snippet", id: batch.join(","), maxResults: 50 });
    for (const item of data.items || []) countries[item.id] = item.snippet.country || null;
  }
  return countries;
}

// Runs a global and a region search for each category, then loads video details
// and channel countries. Each video is tagged with its category and source
// ("global" or "region"; region wins if found in both).
async function searchCategories(categories, region, { after, before, max }) {
  requireEnv(["YOUTUBE_API_KEY"]);
  const jobs = [];
  for (const category of categories) {
    for (const source of ["global", "region"]) {
      const regionCode = source === "region" ? region : undefined;
      jobs.push(searchIds(category, { after, before, max, regionCode }).then((ids) => ({ ids, source, category })));
    }
  }
  const results = await Promise.all(jobs);

  const found = new Map(); // "category|id" -> { id, category, source }
  for (const { ids, source, category } of results) {
    for (const id of ids) {
      const key = `${category}|${id}`;
      if (!found.has(key) || source === "region") found.set(key, { id, category, source });
    }
  }
  if (found.size === 0) return [];

  const uniqueIds = [...new Set([...found.values()].map((f) => f.id))];
  const details = new Map((await fetchVideoDetails(uniqueIds)).map((v) => [v.id, v]));
  const countries = await fetchChannelCountries([...details.values()].map((v) => v.channelId));

  return [...found.values()]
    .filter((f) => details.has(f.id))
    .map((f) => {
      const v = details.get(f.id);
      return { ...v, category: f.category, source: f.source, channelCountry: countries[v.channelId] || null };
    });
}

// The 7-day search (30 results per search).
export async function fetchCurrentVideos(categories, region, publishedAfter) {
  const videos = await searchCategories(categories, region, { after: publishedAfter, max: SEARCH_MAX_RESULTS });
  if (videos.length === 0) throw new UserError("YouTube returned no videos for these categories in the last 7 days.");
  return videos;
}

// The 90-day search (50 results per search), only for categories with no saved history.
// It stops where the current 7-day window starts, so the two never overlap.
export async function fetchHistoryVideos(categories, region, historyStart, windowStart) {
  const videos = await searchCategories(categories, region, { after: historyStart, before: windowStart, max: HISTORY_SEARCH_RESULTS });
  return videos.filter((v) => !isShort(v.durationSeconds));
}
