// All AI work goes through OpenAI. The model name comes from OPENAI_MODEL.
import OpenAI from "openai";
import { UserError, requireEnv } from "./errors.js";
import { validateClusters } from "./validate.js";

// One prompt constant, so it is easy to read and explain.
export const CLUSTER_PROMPT = `You analyse YouTube videos for Ishaan, a tech YouTube creator.
You get a list of videos from the last 7 days (global and from one region).
Find 3 to 5 meaningful trend clusters.
Rules:
- Group by topic, not by channel. Each video belongs to at most one cluster. Some videos may be left out.
- Prefer topics that several different creators are covering at the same time.
- Use ONLY the data provided. Never invent videos, channels or numbers. Refer to videos by id.
- Write short, plain sentences.
Return JSON in exactly this shape:
{ "clusters": [ { "trendName": "", "whatIsHappening": "", "whyItMattersNow": "", "whatCreatorsAreDoing": "", "formatsUsed": "", "engagementSignals": "", "globalContext": "", "indiaContext": "", "opportunityForIshaan": "", "suggestedContentAngle": "", "videoIds": [] } ] }`;

// Ask OpenAI for clusters. Retry once if the answer is not valid.
export async function clusterVideos(videos) {
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
    source: v.source,
    channelCountry: v.channelCountry,
  }));
  const knownIds = new Set(videos.map((v) => v.id));

  for (let attempt = 1; attempt <= 2; attempt++) {
    let text;
    try {
      const res = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CLUSTER_PROMPT },
          { role: "user", content: JSON.stringify(compact) },
        ],
      });
      text = res.choices[0].message.content;
    } catch (err) {
      throw new UserError(`OpenAI request failed: ${String(err.message || err).slice(0, 150)}`);
    }

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {}
    const result = validateClusters(parsed, knownIds);
    if (result.ok) return result.clusters;
  }
  throw new UserError("OpenAI did not return a valid result. Please try again.");
}
