// The one main pipeline. Generate Now and the Sunday cron both call runPipeline(trigger).
// Flow: YouTube data -> processing -> OpenAI -> clusters -> ranking -> save -> email.
import { WINDOW_DAYS, RATE_LIMIT_MINUTES, MIN_VIDEOS_AFTER_CLEANING, HISTORY_DAYS, HISTORY_WEEKS, MAX_HISTORY_TITLES } from "./config.js";
import { UserError, requireEnv, friendlyMessage } from "./errors.js";
import { getSettings, saveBrief, updateEmailStatus, ranRecently, categoriesWithHistory, saveHistoryVideos, getHistoryVideos } from "./db.js";
import { fetchCurrentVideos, fetchHistoryVideos } from "./youtube.js";
import { cleanVideos, topByViewsPerHour } from "./process.js";
import { clusterVideos } from "./openai.js";
import { CLUSTER_TEXT_FIELDS } from "./validate.js";
import { clusterMeasures, rankClusters } from "./ranking.js";
import { replaceIds } from "./text.js";
import { weeklyCounts, recurrenceWeeks, assignLabel } from "./history.js";
import { sendBriefEmail } from "./email.js";
import { getOwnChannelSection } from "./ownchannel.js";

// trigger is "manual" (Generate Now) or "cron" (Sunday run).
export async function runPipeline(trigger) {
  const startedAt = new Date();
  let settings = null;

  try {
    requireEnv(["DATABASE_URL"]);

    // Generate Now: only one run every 5 minutes.
    if (trigger === "manual" && (await ranRecently(RATE_LIMIT_MINUTES))) {
      return { ok: false, rateLimited: true, message: `A brief was generated in the last ${RATE_LIMIT_MINUTES} minutes. Please wait a little and try again.` };
    }

    settings = await getSettings();

    // 1. YouTube data for the last 7 days (global + selected region).
    //    At the same time, backfill 90 days of history for categories that have none saved yet.
    const DAY = 24 * 3600 * 1000;
    const windowStart = startedAt.getTime() - WINDOW_DAYS * DAY;
    const have = new Set(await categoriesWithHistory());
    const needBackfill = settings.categories.filter((c) => !have.has(c));
    const backfill = needBackfill.length
      ? fetchHistoryVideos(
          needBackfill,
          settings.region,
          new Date(startedAt.getTime() - HISTORY_DAYS * DAY).toISOString(),
          new Date(windowStart).toISOString()
        ).then(saveHistoryVideos)
      : Promise.resolve();
    const [raw] = await Promise.all([
      fetchCurrentVideos(settings.categories, settings.region, new Date(windowStart).toISOString()),
      backfill,
    ]);

    // Saved history: the 12 weeks before the current window (the current week is never included).
    const history = await getHistoryVideos(
      settings.categories,
      new Date(windowStart - HISTORY_WEEKS * 7 * DAY).toISOString(),
      new Date(windowStart).toISOString()
    );
    const historyById = new Map(history.map((h) => [h.id, h]));

    // 2. Data processing: remove duplicates and Shorts, keep the top 80.
    const cleaned = cleanVideos(raw, startedAt.getTime());
    if (cleaned.length < MIN_VIDEOS_AFTER_CLEANING) {
      throw new UserError(`Only ${cleaned.length} videos were left after cleaning (at least ${MIN_VIDEOS_AFTER_CLEANING} needed). Try broader categories.`);
    }
    const videos = topByViewsPerHour(cleaned);

    // 3. OpenAI groups the videos into 3-5 trend clusters.
    //    At the same time, Ishaan's own channel is reviewed (if connected).
    const titles = history.slice(0, MAX_HISTORY_TITLES).map((h) => ({ id: h.id, title: h.title }));
    const [aiClusters, ownChannel] = await Promise.all([clusterVideos(videos, titles), getOwnChannelSection(startedAt.getTime())]);

    // 4. Code calculates the numbers and ranks the clusters.
    const byId = new Map(videos.map((v) => [v.id, v]));
    const withNumbers = aiClusters.map((c) => {
      const clusterVids = c.videoIds.map((id) => byId.get(id));
      // Code counts related historical videos per week and decides the label.
      const related = c.relatedHistoryIds.map((id) => historyById.get(id));
      const weekly = weeklyCounts(related.map((h) => h.publishedAt), windowStart);
      const recurrence = history.length > 0 ? recurrenceWeeks(weekly) : null; // no history: drop it from the ranking
      // The text may mention video ids: show the video title instead.
      const idToTitle = Object.fromEntries(clusterVids.map((v) => [v.id, v.title]));
      const text = Object.fromEntries(CLUSTER_TEXT_FIELDS.map((f) => [f, replaceIds(c[f], idToTitle)]));
      return {
        ...c,
        ...text,
        label: assignLabel(weekly),
        weeklyCounts: weekly,
        measures: clusterMeasures(clusterVids, recurrence),
        videos: clusterVids.map((v) => ({
          id: v.id,
          title: v.title,
          channelName: v.channelName,
          views: v.views,
          isIndia: v.isIndia,
        })),
      };
    });
    const clusters = rankClusters(withNumbers);

    // 5. Save the brief, then 6. email it. An email failure never loses the brief.
    const briefId = await saveBrief({
      createdAt: startedAt,
      trigger,
      status: "ok",
      windowDays: WINDOW_DAYS,
      region: settings.region,
      categories: settings.categories,
      clusters,
      ownChannel,
    });

    // Keep this week's videos as history for future runs (they never count in their own week).
    try {
      await saveHistoryVideos(cleaned);
    } catch {}

    try {
      await sendBriefEmail(clusters, ownChannel);
      await updateEmailStatus(briefId, "sent", null);
    } catch (err) {
      await updateEmailStatus(briefId, "failed", friendlyMessage(err));
    }
    return { ok: true, briefId, message: "Brief generated." };
  } catch (err) {
    const message = friendlyMessage(err);
    // Save failed runs too (needs the database; skip silently if that is the problem).
    try {
      await saveBrief({
        createdAt: startedAt,
        trigger,
        status: "failed",
        error: message,
        windowDays: WINDOW_DAYS,
        region: settings ? settings.region : null,
        categories: settings ? settings.categories : [],
      });
    } catch {}
    return { ok: false, message };
  }
}
