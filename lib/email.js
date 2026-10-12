// Sends the brief by email with Resend.
import { Resend } from "resend";
import { UserError, requireEnv } from "./errors.js";

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Builds the email body from the ranked clusters.
export function buildEmailHtml(clusters, appUrl) {
  const trends = clusters
    .map((c) => `<li><b>${escapeHtml(c.trendName)}</b><br>${escapeHtml(c.whatIsHappening)}</li>`)
    .join("");

  const byIndia = [...clusters].sort((a, b) => b.measures.indiaOpportunity - a.measures.indiaOpportunity);
  const india = byIndia
    .map(
      (c) =>
        `<li><b>${escapeHtml(c.trendName)}</b> (global ${c.measures.globalCount}, India ${c.measures.indiaCount})<br>${escapeHtml(c.indiaContext)}</li>`
    )
    .join("");

  const todo = clusters
    .slice(0, 3)
    .map((c) => `<li>${escapeHtml(c.suggestedContentAngle)}</li>`)
    .join("");

  return `<div style="font-family:Arial,sans-serif;max-width:600px">
    <h2>Your YouTube Trend Radar brief</h2>
    <h3>Top trend clusters</h3><ol>${trends}</ol>
    <h3>India opportunity</h3><ul>${india}</ul>
    <h3>Key recommendations</h3><ul>${todo}</ul>
    <p><a href="${escapeHtml(appUrl)}">Open the dashboard</a></p>
  </div>`;
}

// Throws a friendly error if sending fails (the pipeline catches it and keeps the brief).
export async function sendBriefEmail(clusters) {
  requireEnv(["RESEND_API_KEY", "RESEND_FROM", "BRIEF_EMAIL_TO", "APP_URL"]);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM,
    to: process.env.BRIEF_EMAIL_TO,
    subject: "Your weekly YouTube Trend Radar brief",
    html: buildEmailHtml(clusters, process.env.APP_URL),
  });
  if (error) throw new UserError(`Email could not be sent: ${error.message}`);
}
