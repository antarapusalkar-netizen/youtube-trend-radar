// Sends the brief by email with Resend.
import { Resend } from "resend";
import { UserError, requireEnv } from "./errors.js";
import { notEnoughDataText } from "./ownstats.js";

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const num = (n) => Number(n).toLocaleString("en-US");
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

// Small helpers so the email styling stays in one place (inline styles, as email apps need).
const h2 = (t) => `<h2 style="font-size:24px;margin:36px 0 12px;color:#111827;border-bottom:2px solid #e5e7eb;padding-bottom:8px">${t}</h2>`;
const field = (title, text) =>
  `<p style="margin:0 0 12px;font-size:16px;line-height:1.6"><b style="color:#4f46e5">${title}:</b> ${escapeHtml(text)}</p>`;
const chip = (t) => `<span style="display:inline-block;background:#eef0f4;border-radius:12px;padding:2px 10px;font-size:13px;margin:0 6px 6px 0">${t}</span>`;
const videoLink = (v) =>
  `<li style="margin-bottom:6px"><a href="https://www.youtube.com/watch?v=${escapeHtml(v.id)}" style="color:#4f46e5">${escapeHtml(v.title)}</a> <span style="color:#667085">- ${escapeHtml(v.channelName)}, ${num(v.views)} views</span></li>`;

// Builds the full email body (same detail as the dashboard).
export function buildEmailHtml(clusters, appUrl, ownChannel) {
  const trends = clusters
    .map(
      (c) => `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px">
      <h3 style="margin:0 0 4px;font-size:20px;color:#111827">#${c.rank} ${escapeHtml(c.trendName)}${c.label ? ` <span style="font-size:13px;background:#eef0ff;color:#4f46e5;border-radius:12px;padding:2px 10px;vertical-align:middle">${escapeHtml(c.label)}</span>` : ""}</h3>
      <p style="margin:8px 0 16px;font-size:17px;line-height:1.6">${escapeHtml(c.whatIsHappening)}</p>
      ${field("Why it matters now", c.whyItMattersNow)}
      ${field("What creators are doing", c.whatCreatorsAreDoing)}
      ${field("Formats used", c.formatsUsed)}
      ${field("Engagement signals", c.engagementSignals)}
      ${field("Global context", c.globalContext)}
      ${field("India context", c.indiaContext)}
      <div style="background:#eef0ff;border-radius:10px;padding:14px 16px;margin:16px 0">
        ${field("Opportunity for Ishaan", c.opportunityForIshaan)}
        ${field("Suggested content angle", c.suggestedContentAngle)}
      </div>
      <div style="margin-bottom:12px">
        ${chip(`${num(Math.round(c.measures.momentum))} views/hour`)}${chip(`${num(c.measures.views)} total views`)}${chip(`${pct(c.measures.engagement)} engagement`)}${chip(`${c.measures.breadth} creators`)}${chip("Watch quality: not available")}
      </div>
      <p style="margin:0 0 6px;font-size:14px;color:#667085"><b>Videos in this cluster</b></p>
      <ul style="margin:0;padding-left:20px;font-size:15px">${c.videos.map(videoLink).join("")}</ul>
    </div>`
    )
    .join("");

  const byIndia = [...clusters].sort((a, b) => b.measures.indiaOpportunity - a.measures.indiaOpportunity);
  const india = byIndia
    .map(
      (c) => `<div style="margin-bottom:16px;font-size:16px;line-height:1.6">
      <b>${escapeHtml(c.trendName)}</b><br>
      <span style="color:#4f46e5;font-weight:bold">${pct(c.measures.indiaOpportunity)} opportunity</span>
      <span style="color:#667085"> - India ${c.measures.indiaCount}, other countries ${c.measures.otherCount}, country unknown ${c.measures.unknownCount}</span><br>
      ${escapeHtml(c.opportunityForIshaan)}</div>`
    )
    .join("");

  // "Your Last 7 Days"
  let own = '<p style="font-size:16px">Not connected yet. Open the dashboard and click Connect YouTube Channel.</p>';
  if (ownChannel && ownChannel.status === "ok") {
    const t = ownChannel.totals;
    own = `<p style="color:#667085;font-size:14px">${escapeHtml(ownChannel.channelTitle)} - ${ownChannel.range.startDate} to ${ownChannel.range.endDate}</p>
      <div style="margin-bottom:12px">${chip(`${num(t.views)} views`)}${chip(`${num(t.likes)} likes`)}${chip(`${num(t.comments)} comments`)}${chip(`${num(t.estimatedMinutesWatched)} minutes watched`)}${chip(`avg view ${mmss(t.averageViewDuration)}`)}${chip(`avg ${Number(t.averageViewPercentage).toFixed(1)}% watched`)}${chip(`${num(t.subscribersGained)} subscribers gained`)}</div>
      ${field("What worked", ownChannel.insights.whatWorked)}
      ${field("What did not work", ownChannel.insights.whatDidNotWork)}
      ${field("What to repeat", ownChannel.insights.whatToRepeat)}
      ${field("What to change", ownChannel.insights.whatToChange)}
      <ul style="padding-left:20px;font-size:15px">${ownChannel.videos
        .map((v) => `<li style="margin-bottom:6px">${escapeHtml(v.title)} <span style="color:#667085">- ${num(v.views)} views, ${num(v.likes)} likes, ${num(v.comments)} comments</span></li>`)
        .join("")}</ul>`;
  } else if (ownChannel && ownChannel.status === "not_enough_data") {
    own = `<p style="font-size:16px">${escapeHtml(notEnoughDataText(ownChannel.usableVideos))}</p>`;
  } else if (ownChannel && ownChannel.status === "error") {
    own = `<p style="font-size:16px">${escapeHtml(ownChannel.message)}</p>`;
  }

  const todo = clusters
    .map((c) => `<li style="margin-bottom:10px"><b>${escapeHtml(c.trendName)}:</b> ${escapeHtml(c.suggestedContentAngle)}</li>`)
    .join("");

  return `<meta charset="utf-8"><div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#17202b">
    <h1 style="font-size:30px;margin:0 0 4px">Your YouTube Trend Radar brief</h1>
    <p style="margin:0;color:#667085;font-size:16px">Weekly content strategy brief for Ishaan</p>
    ${h2("Top trend clusters")}${trends}
    ${h2("India opportunity")}${india}
    ${h2("Your Last 7 Days")}${own}
    ${h2("Key recommendations")}<ol style="font-size:16px;line-height:1.6;padding-left:22px">${todo}</ol>
    <p style="margin-top:32px"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 26px;border-radius:8px">Open the full dashboard</a></p>
  </div>`;
}

// Throws a friendly error if sending fails (the pipeline catches it and keeps the brief).
export async function sendBriefEmail(clusters, ownChannel) {
  requireEnv(["RESEND_API_KEY", "RESEND_FROM", "BRIEF_EMAIL_TO", "APP_URL"]);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM,
    to: process.env.BRIEF_EMAIL_TO,
    subject: "Your weekly YouTube Trend Radar brief",
    html: buildEmailHtml(clusters, process.env.APP_URL, ownChannel),
  });
  if (error) throw new UserError(`Email could not be sent: ${error.message}`);
}
