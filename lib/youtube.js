// Talks to the YouTube Data API. Each search costs 100 quota units.
import { UserError, requireEnv } from "./errors.js";
import { SEARCH_MAX_RESULTS } from "./config.js";
import { parseDuration, toNumberOrNull } from "./process.js";

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
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
    throw new UserError("The YouTube daily quota is used up. Try again tomorrow.");
  }
  if (reason === "keyInvalid" || reason === "badRequest" || res.status === 400 || res.status === 403) {
    throw new UserError("YouTube rejected the request. Check that YOUTUBE_API_KEY is valid and the YouTube Data API v3 is enabled.");
  }
  throw new UserError(`YouTube returned an error (status ${res.status}).`);
}

// Search one category once. regionCode is left out for the global search.
async function searchIds(query, publishedAfter, regionCode) {
  const data = await callYouTube("search", {
    part: "snippet",
    type: "video",
    order: "viewCount",
    publishedAfter,
    maxResults: SEARCH_MAX_RESULTS,
    q: query,
    regionCode,
  });
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

// The 7-day search: for every category, one global and one region search.
// Returns videos tagged with source "global" or "region" (region wins if found in both).
export async function fetchCurrentVideos(categories, region, publishedAfter) {
  requireEnv(["YOUTUBE_API_KEY"]);
  const jobs = [];
  for (const category of categories) {
    jobs.push(searchIds(category, publishedAfter, undefined).then((ids) => ({ ids, source: "global" })));
    jobs.push(searchIds(category, publishedAfter, region).then((ids) => ({ ids, source: "region" })));
  }
  const results = await Promise.all(jobs);

  const sourceById = new Map();
  for (const { ids, source } of results) {
    for (const id of ids) if (sourceById.get(id) !== "region") sourceById.set(id, source);
  }
  if (sourceById.size === 0) throw new UserError("YouTube returned no videos for these categories in the last 7 days.");

  const videos = await fetchVideoDetails([...sourceById.keys()]);
  const countries = await fetchChannelCountries(videos.map((v) => v.channelId));
  return videos.map((v) => ({ ...v, source: sourceById.get(v.id), channelCountry: countries[v.channelId] || null }));
}
