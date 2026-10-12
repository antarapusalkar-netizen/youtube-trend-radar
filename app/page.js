// The one dashboard page. Everything is on a single scroll.
import Link from "next/link";
import SettingsForm from "./SettingsForm";
import GenerateButton from "./GenerateButton";
import { getSettings, getBrief, getLatestBrief, listBriefs } from "@/lib/db.js";
import { REGIONS, MIN_CATEGORIES, MAX_CATEGORIES, DEFAULT_CATEGORIES, DEFAULT_REGION } from "@/lib/config.js";
import { friendlyMessage } from "@/lib/errors.js";

export const dynamic = "force-dynamic";

// All times are shown in India time.
const formatTime = (d) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const num = (n) => Number(n).toLocaleString("en-IN");
const pct = (n) => `${(n * 100).toFixed(1)}%`;

export default async function Page({ searchParams }) {
  const { brief: briefParam } = await searchParams;

  let settings = { region: DEFAULT_REGION, categories: DEFAULT_CATEGORIES };
  let latest = null; // newest run of any status
  let shown = null; // the brief we display
  let past = [];
  let loadError = null;

  try {
    settings = await getSettings();
    latest = await getLatestBrief(false);
    past = await listBriefs();
    shown = briefParam ? await getBrief(Number(briefParam) || 0) : await getLatestBrief(true);
  } catch (err) {
    loadError = friendlyMessage(err);
  }

  const clusters = shown && shown.status === "ok" ? shown.clusters || [] : [];
  const indiaSorted = [...clusters].sort((a, b) => b.measures.indiaOpportunity - a.measures.indiaOpportunity);
  const returning = clusters.filter((c) => c.label === "Recurring" || c.label === "Returning");
  const viewingOld = Boolean(briefParam);

  return (
    <main>
      <h1>YouTube Trend Radar</h1>

      {loadError && <div className="error">{loadError}</div>}

      {/* 1. Settings + Generate Now */}
      <section className="card">
        <h2>Settings</h2>
        <SettingsForm
          initialCategories={settings.categories}
          initialRegion={settings.region}
          regions={REGIONS}
          min={MIN_CATEGORIES}
          max={MAX_CATEGORIES}
        />
        <hr />
        <p className="note">Settings are used when a brief is generated, so save them first.</p>
        <GenerateButton />
      </section>

      {/* Latest run failed: show the error above the last good brief */}
      {!viewingOld && latest && latest.status === "failed" && (
        <div className="error">
          The latest run ({formatTime(latest.created_at)}) failed: {latest.error}
          {shown && " Showing the last successful brief below."}
        </div>
      )}
      {viewingOld && (
        <p className="note">
          Viewing an older brief. <Link href="/">Back to latest</Link>
        </p>
      )}
      {shown && shown.status === "failed" && <div className="error">This run failed: {shown.error}</div>}
      {shown && shown.email_status === "failed" && <div className="error">Email was not sent: {shown.email_error}</div>}
      {shown && shown.status === "ok" && (
        <p className="note">
          Brief from {formatTime(shown.created_at)} · last {shown.window_days} days · region {shown.region}
        </p>
      )}

      {/* 2. Top trend clusters */}
      <section>
        <h2>Top Trend Clusters</h2>
        {clusters.length === 0 && <p className="empty">No brief yet. Press Generate Now to create the first one.</p>}
        {clusters.map((c) => (
          <article className="card cluster" key={c.rank}>
            <div className="head">
              <span className="badge">#{c.rank}</span>
              <h3>{c.trendName}</h3>
              {c.label && <span className="label">{c.label}</span>}
            </div>
            <p><b>What is happening:</b> {c.whatIsHappening}</p>
            <p><b>Why it matters now:</b> {c.whyItMattersNow}</p>
            <p><b>What creators are doing:</b> {c.whatCreatorsAreDoing}</p>
            <p><b>Formats used:</b> {c.formatsUsed}</p>
            <p><b>Engagement signals:</b> {c.engagementSignals}</p>
            <p><b>Global context:</b> {c.globalContext}</p>
            <p><b>India context:</b> {c.indiaContext}</p>
            <p><b>Opportunity for Ishaan:</b> {c.opportunityForIshaan}</p>
            <p><b>Suggested content angle:</b> {c.suggestedContentAngle}</p>
            <div className="numbers">
              <span>Views/hour: {num(Math.round(c.measures.momentum))}</span>
              <span>Total views: {num(c.measures.views)}</span>
              <span>Engagement: {pct(c.measures.engagement)}</span>
              <span>Creators: {c.measures.breadth}</span>
              <span>Watch quality: Not available</span>
              <span>Score: {c.score.toFixed(2)}</span>
            </div>
            <ul className="videos">
              {c.videos.map((v) => (
                <li key={v.id}>
                  <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer">{v.title}</a>
                  <span className="note"> · {v.channelName} · {num(v.views)} views</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      {/* 3. India opportunity */}
      <section>
        <h2>India Opportunity</h2>
        <p className="note">India creators are an approximation: a video counts as India if it came from the region search or its channel country is IN. Channels with no country are not counted.</p>
        {indiaSorted.length === 0 && <p className="empty">Shows up once a brief exists.</p>}
        {indiaSorted.map((c) => (
          <div className="card" key={c.rank}>
            <h3>{c.trendName}</h3>
            <p className="numbers">
              <span>Opportunity: {pct(c.measures.indiaOpportunity)}</span>
              <span>Global videos: {c.measures.globalCount}</span>
              <span>India videos: {c.measures.indiaCount}</span>
            </p>
            <p>{c.opportunityForIshaan}</p>
          </div>
        ))}
      </section>

      {/* 5. Recurring / Returning topics */}
      <section>
        <h2>Recurring / Returning Topics</h2>
        {returning.length === 0 && <p className="empty">No recurring or returning topics in this brief.</p>}
        {returning.map((c) => {
          const biggest = Math.max(...c.weeklyCounts, 1);
          return (
            <div className="card" key={c.rank}>
              <h3>
                {c.trendName} <span className="label">{c.label}</span>
              </h3>
              <p className="note">Related videos per week, oldest to newest (last 12 weeks before this brief):</p>
              <div className="weeks">
                {c.weeklyCounts.map((n, i) => (
                  <div key={i} className="week">
                    <div className="bar" style={{ height: `${(n / biggest) * 40}px` }} />
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* 6. Previous briefs */}
      <section>
        <h2>Previous Briefs</h2>
        {past.length === 0 && <p className="empty">No briefs yet.</p>}
        <ul className="past">
          {past.map((b) => (
            <li key={b.id}>
              <Link href={`/?brief=${b.id}`}>{formatTime(b.created_at)}</Link>
              <span className="note"> · {b.trigger === "cron" ? "Sunday run" : "Generate Now"} · {b.status}</span>
            </li>
          ))}
        </ul>
        {viewingOld && <Link href="/">Back to latest</Link>}
      </section>
    </main>
  );
}
