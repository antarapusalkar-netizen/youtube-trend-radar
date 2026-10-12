// All AI work goes through OpenAI. The model name comes from OPENAI_MODEL.
import OpenAI from "openai";
import { UserError, requireEnv } from "./errors.js";
import { validateClusters } from "./validate.js";
import { isReasoningEffortRejected, withReasoningEffort } from "./aiparams.js";

// One prompt constant, so it is easy to read and explain.
export const CLUSTER_PROMPT = `You analyse YouTube videos for Ishaan, a tech YouTube creator.
You get "videos" from the last 7 days. Each video has isIndia and channelCountry, worked out by code.
Find 3 to 5 trend clusters.
Rules:
- Every cluster must contain at least 3 videos about the SAME specific topic, with a clear shared underlying topic.
- Do not merge unrelated topics. Do not make a broad cluster just because videos fall into the same general category.
- Group by topic, not by channel. Each video belongs to at most one cluster. Some videos may be left out.
- Leave out videos that are not about AI or tech.
- Use video titles and the other video data to understand the topic.
- Use isIndia and channelCountry ONLY for statements about geography. isIndia=true means the channel country is IN. Never say a video is India-based unless isIndia is true. If a cluster has any video with isIndia=true, never say that no India-based videos exist.
- Do not invent trends, videos, creators, channels, countries or numbers. Use ONLY the data provided. Refer to videos by id.
- Write short, plain sentences.
You also get "history": older videos (id and title) from before the last 7 days.
For each cluster, put in relatedHistoryIds the ids of history videos about the same topic. Use only ids from "history". Use [] if none.
Return JSON in exactly this shape:
{ "clusters": [ { "trendName": "", "whatIsHappening": "", "whyItMattersNow": "", "whatCreatorsAreDoing": "", "formatsUsed": "", "engagementSignals": "", "globalContext": "", "indiaContext": "", "opportunityForIshaan": "", "suggestedContentAngle": "", "videoIds": [], "relatedHistoryIds": [] } ] }`;

// Calls the model with JSON output and reasoning effort "low".
// If the model does not support reasoning_effort, it is dropped and the request is repeated without it.
let reasoningSupported; // undefined = not known yet
async function askJson(client, messages) {
  const body = { model: process.env.OPENAI_MODEL, response_format: { type: "json_object" }, messages };
  try {
    const res = await client.chat.completions.create(withReasoningEffort(body, reasoningSupported));
    if (reasoningSupported === undefined) reasoningSupported = true;
    return res;
  } catch (err) {
    if (reasoningSupported === false || !isReasoningEffortRejected(err)) throw err;
    reasoningSupported = false;
    return client.chat.completions.create(body);
  }
}

// Ask OpenAI for clusters. Retry once if the answer is not valid.
// history is a list of { id, title } from the saved 90-day history (can be empty).
export async function clusterVideos(videos, history) {
  requireEnv(["OPENAI_API_KEY", "OPENAI_MODEL"]);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Compact version of each video, to keep the request small.
  const compact = videos.map((v) => ({
    id: v.id,
    title: v.title,
    channel: v.channelName,
    hoursOld: Math.round(v.hoursOld * 10) / 10,
    views: v.views,
    viewsPerHour: Math.round(v.viewsPerHour),
    likes: v.likes,
    comments: v.comments,
    durationMinutes: Math.round((v.durationSeconds / 60) * 10) / 10,
    tags: v.tags.slice(0, 5),
    isIndia: v.isIndia,
    channelCountry: v.channelCountry,
  }));
  const knownIds = new Set(videos.map((v) => v.id));
  const historyIds = new Set(history.map((h) => h.id));
  const videoInfo = new Map(videos.map((v) => [v.id, { isIndia: v.isIndia }]));

  for (let attempt = 1; attempt <= 2; attempt++) {
    let text;
    try {
      const res = await askJson(client, [
        { role: "system", content: CLUSTER_PROMPT },
        { role: "user", content: JSON.stringify({ videos: compact, history }) },
      ]);
      text = res.choices[0].message.content;
    } catch (err) {
      throw new UserError(`OpenAI request failed: ${String(err.message || err).slice(0, 150)}`);
    }

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {}
    const result = validateClusters(parsed, knownIds, historyIds, videoInfo);
    if (result.ok) return result.clusters;
  }
  throw new UserError("OpenAI did not return a valid result. Please try again.");
}

// ---- Ishaan's own channel ----
export const OWN_PROMPT = `You explain a YouTube creator's own analytics for the last 7 days.
Use ONLY the numbers provided. Never invent videos or numbers. Refer to videos by title.
Write short, plain sentences. Be honest if the data is thin.
Return JSON in exactly this shape:
{ "whatWorked": "", "whatDidNotWork": "", "whatToRepeat": "", "whatToChange": "" }`;

const OWN_FIELDS = ["whatWorked", "whatDidNotWork", "whatToRepeat", "whatToChange"];

// data = { range, totals, videos } straight from the Analytics API (numbers come from code).
export async function interpretOwnChannel(data) {
  requireEnv(["OPENAI_API_KEY", "OPENAI_MODEL"]);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  for (let attempt = 1; attempt <= 2; attempt++) {
    let text;
    try {
      const res = await askJson(client, [
        { role: "system", content: OWN_PROMPT },
        { role: "user", content: JSON.stringify(data) },
      ]);
      text = res.choices[0].message.content;
    } catch (err) {
      throw new UserError(`OpenAI request failed: ${String(err.message || err).slice(0, 150)}`);
    }
    try {
      const parsed = JSON.parse(text);
      if (OWN_FIELDS.every((f) => typeof parsed[f] === "string" && parsed[f].trim() !== "")) {
        return Object.fromEntries(OWN_FIELDS.map((f) => [f, parsed[f].trim()]));
      }
    } catch {}
  }
  throw new UserError("OpenAI did not return a valid result for your channel.");
}
