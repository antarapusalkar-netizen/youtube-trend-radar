// The one main pipeline. Generate Now and the Sunday cron both call runPipeline(trigger).
// Flow: YouTube data -> processing -> OpenAI -> clusters -> ranking -> save -> email.
import { WINDOW_DAYS, RATE_LIMIT_MINUTES, MIN_VIDEOS_AFTER_CLEANING } from "./config.js";
import { UserError, requireEnv, friendlyMessage } from "./errors.js";
import { getSettings, saveBrief, updateEmailStatus, ranRecently } from "./db.js";
import { fetchCurrentVideos } from "./youtube.js";
import { cleanVideos, topByViewsPerHour } from "./process.js";
import { clusterVideos } from "./openai.js";
import { clusterMeasures, rankClusters } from "./ranking.js";
import { sendBriefEmail } from "./email.js";

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
    const since = new Date(startedAt.getTime() - WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
    const raw = await fetchCurrentVideos(settings.categories, settings.region, since);

    // 2. Data processing: remove duplicates and Shorts, keep the top 80.
    const cleaned = cleanVideos(raw, startedAt.getTime());
    if (cleaned.length < MIN_VIDEOS_AFTER_CLEANING) {
      throw new UserError(`Only ${cleaned.length} videos were left after cleaning (at least ${MIN_VIDEOS_AFTER_CLEANING} needed). Try broader categories.`);
    }
    const videos = topByViewsPerHour(cleaned);

    // 3. OpenAI groups the videos into 3-5 trend clusters.
    const aiClusters = await clusterVideos(videos);

    // 4. Code calculates the numbers and ranks the clusters.
    const byId = new Map(videos.map((v) => [v.id, v]));
    const withNumbers = aiClusters.map((c) => {
      const clusterVids = c.videoIds.map((id) => byId.get(id));
      return {
        ...c,
        label: null, // New / Growing / Recurring / Returning arrives in Layer 2
        measures: clusterMeasures(clusterVids),
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
    });
    try {
      await sendBriefEmail(clusters);
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
