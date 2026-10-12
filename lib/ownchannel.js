// "Your Last 7 Days": numbers come from the YouTube Analytics API, OpenAI only explains them.
import { UserError, friendlyMessage } from "./errors.js";
import { OWN_TOP_VIDEOS } from "./config.js";
import { getConnection } from "./db.js";
import { getAccessToken } from "./google.js";
import { fetchVideoDetails } from "./youtube.js";
import { analyticsRange, rowsToObjects, hasEnoughData } from "./ownstats.js";
import { interpretOwnChannel } from "./openai.js";

const METRICS = "views,likes,comments,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained";

async function report(accessToken, params) {
  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  url.searchParams.set("ids", "channel==MINE");
  url.searchParams.set("metrics", METRICS);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  } catch {
    throw new UserError("Could not reach YouTube Analytics. Try again.");
  }
  if (!res.ok) {
    throw new UserError("YouTube Analytics refused the request. Check that the YouTube Analytics API is enabled and reconnect the channel.");
  }
  const data = await res.json();
  return rowsToObjects(data.columnHeaders, data.rows);
}

// Always returns an object with a status, and never throws: a problem here must not stop the main brief.
// status: "ok" | "not_connected" | "not_enough_data" | "error"
export async function getOwnChannelSection(now = Date.now()) {
  try {
    const connection = await getConnection();
    if (!connection) return { status: "not_connected" };

    const accessToken = await getAccessToken(connection.refresh_token);
    const { startDate, endDate } = analyticsRange(now);
    const range = { startDate, endDate };

    const [totalsRows, videoRows] = await Promise.all([
      report(accessToken, { startDate, endDate }),
      report(accessToken, { startDate, endDate, dimensions: "video", sort: "-views", maxResults: OWN_TOP_VIDEOS }),
    ]);
    const base = { channelTitle: connection.channel_title, range };

    if (!hasEnoughData(videoRows)) return { status: "not_enough_data", ...base };

    // Add the titles to the top videos.
    const details = new Map((await fetchVideoDetails(videoRows.map((v) => v.video))).map((v) => [v.id, v]));
    const videos = videoRows.map((v) => ({ ...v, id: v.video, title: details.get(v.video)?.title || v.video }));
    const totals = totalsRows[0] || {};

    const insights = await interpretOwnChannel({ range, totals, videos });
    return { status: "ok", ...base, totals, videos, insights };
  } catch (err) {
    return { status: "error", message: friendlyMessage(err) };
  }
}
