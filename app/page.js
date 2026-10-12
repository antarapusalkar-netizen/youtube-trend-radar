// The one dashboard page. A top bar plus tabs (the tabs switch in the browser, nothing is re-fetched).
import Link from "next/link";
import SettingsForm from "./SettingsForm";
import GenerateButton from "./GenerateButton";
import Tabs from "./Tabs";
import { getSettings, getBrief, getLatestBrief, listBriefs, getConnectionInfo } from "@/lib/db.js";
import { weekPieSlices } from "@/lib/history.js";
import { WEIGHTS, REGIONS, MIN_CATEGORIES, MAX_CATEGORIES, DEFAULT_CATEGORIES, DEFAULT_REGION } from "@/lib/config.js";
import { friendlyMessage } from "@/lib/errors.js";
import { triggerLabel, emailStatusText } from "@/lib/text.js";
import { notEnoughDataText } from "@/lib/ownstats.js";
import { scoreExplanation } from "@/lib/text.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// All times are shown in India time.
const formatTime = (d) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const num = (n) => (n === undefined || n === null || Number.isNaN(Number(n)) ? "-" : Number(n).toLocaleString("en-US"));
const mmss = (sec) => (sec === undefined || sec === null || Number.isNaN(Number(sec)) ? "-" : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`);
// Pie slices: India, other countries, unknown.
const pieGradient = (m) => {
  const total = m.indiaCount + m.otherCount + m.unknownCount || 1;
  const a = (m.indiaCount / total) * 100;
  const b = a + (m.otherCount / total) * 100;
  return `conic-gradient(#4f46e5 0 ${a}%, #f59e0b ${a}% ${b}%, #9ca3af ${b}% 100%)`;
};
const watched = (n, digits) => (n === undefined || n === null || Number.isNaN(Number(n)) ? "-" : `${Number(n).toFixed(digits)}%`);
const pct = (n) => `${(n * 100).toFixed(1)}%`;

export default async function Page({ searchParams }) {
  const { brief: briefParam, connected, connect_error: connectError } = await searchParams;

  let settings = { region: DEFAULT_REGION, categories: DEFAULT_CATEGORIES };
  let latest = null; // newest run of any status
  let shown = null; // the brief we display
  let past = [];
  let connection = null;
  let loadError = null;

  try {
    settings = await getSettings();
    latest = await getLatestBrief(false);
    past = await listBriefs();
    connection = await getConnectionInfo();
    shown = briefParam ? await getBrief(Number(briefParam) || 0) : await getLatestBrief(true);
  } catch (err) {
    loadError = friendlyMessage(err);
  }

  const clusters = shown && shown.status === "ok" ? shown.clusters || [] : [];
  const indiaSorted = [...clusters].sort((a, b) => b.measures.indiaOpportunity - a.measures.indiaOpportunity);
  const returning = clusters.filter((c) => c.label === "Recurring" || c.label === "Returning");
  const own = shown && shown.status === "ok" ? shown.own_channel : null;
  const viewingOld = Boolean(briefParam);
  // After coming back from Google sign-in, open the Settings tab so the message is seen.
  const initialTab = connected || connectError ? "settings" : "trends";

  const trendsPanel = (
    <>
        <section>
          <h2 className="section">Top Trend Clusters</h2>
          {clusters.length === 0 && <p className="empty">No brief yet. Press Generate Now to create the first one.</p>}
          {clusters.map((c) => (
            <article className="card cluster" key={c.rank}>
              <div className="head">
                <span className="badge">{c.rank}</span>
                <h3>{c.trendName}</h3>
                {c.label && <span className={`label ${c.label.toLowerCase()}`}>{c.label}</span>}
              </div>
              <p className="lede">{c.whatIsHappening}</p>

              <div className="grid">
                <div><h4>Why it matters now</h4><p>{c.whyItMattersNow}</p></div>
                <div><h4>What creators are doing</h4><p>{c.whatCreatorsAreDoing}</p></div>
                <div><h4>Formats used</h4><p>{c.formatsUsed}</p></div>
                <div><h4>Engagement signals</h4><p>{c.engagementSignals}</p></div>
                <div><h4>Global context</h4><p>{c.globalContext}</p></div>
                <div><h4>India context</h4><p>{c.indiaContext}</p></div>
              </div>

              <div className="callout">
                <h4>Opportunity for Ishaan</h4>
                <p>{c.opportunityForIshaan}</p>
                <h4>Suggested content angle</h4>
                <p>{c.suggestedContentAngle}</p>
              </div>

              <div className="stats">
                <div><b>{num(Math.round(c.measures.momentum))}</b><span>views / hour</span></div>
                <div><b>{num(c.measures.views)}</b><span>total views</span></div>
                <div><b>{pct(c.measures.engagement)}</b><span>engagement</span></div>
                <div><b>{c.measures.breadth}</b><span>creators</span></div>
                <div><b>N/A</b><span>watch quality</span></div>
                <div><b>{c.score.toFixed(2)}</b><span>score</span></div>
              </div>

              <details>
                <summary>{c.videos.length} videos in this cluster</summary>
                <ul className="videos">
                  {c.videos.map((v) => (
                    <li key={v.id}>
                      <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer">{v.title}</a>
                      <span className="note"> · {v.channelName} · {num(v.views)} views</span>
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </section>

        {clusters.length > 0 && <p className="note">{scoreExplanation(WEIGHTS)}</p>}
    </>
  );

  const indiaPanel = (
    <>
        <section>
          <h2 className="section">India Opportunity</h2>
          <p className="note">India is decided only from each video’s YouTube channel country field (country = IN). Channels with no country set are counted as unknown, not as India. The search region is never used. This is an approximation.</p>
          {indiaSorted.length === 0 && <p className="empty">Shows up once a brief exists.</p>}
          {indiaSorted.map((c) => (
            <div className="card india" key={c.rank}>
              <div className="big">{pct(c.measures.indiaOpportunity)}<span>opportunity</span></div>
              <div className="grow">
                <h3>{c.trendName}</h3>
                {c.measures.unknownCount === undefined ? (
                  <p className="note">Older brief: India counts were made with a different rule and are not shown.</p>
                ) : (
                  <p className="note">
                    India: {c.measures.indiaCount} · Other countries: {c.measures.otherCount} · Country unknown: {c.measures.unknownCount}
                  </p>
                )}
                <p>{c.opportunityForIshaan}</p>
              </div>
              {c.measures.unknownCount !== undefined && (
                <div className="pie-box">
                  <div className="pie" style={{ background: pieGradient(c.measures) }} role="img" aria-label={`${c.measures.indiaCount} India, ${c.measures.otherCount} other countries, ${c.measures.unknownCount} unknown`} />
                  <p className="legend"><i style={{ background: "#4f46e5" }} />India {c.measures.indiaCount}</p>
                  <p className="legend"><i style={{ background: "#f59e0b" }} />Other {c.measures.otherCount}</p>
                  <p className="legend"><i style={{ background: "#9ca3af" }} />Unknown {c.measures.unknownCount}</p>
                </div>
              )}
            </div>
          ))}
        </section>

    </>
  );

  const last7Panel = (
    <>
        <section>
          <h2 className="section">Your Last 7 Days</h2>
          {(!own || own.status === "not_connected") && (
            <p className="empty">Your channel is not connected. Use the Connect YouTube Channel button at the top, then generate a new brief.</p>
          )}
          {own && own.status === "not_enough_data" && <p className="empty">{notEnoughDataText(own.usableVideos)}</p>}
          {own && own.status === "error" && <div className="error">{own.message}</div>}
          {own && own.status === "ok" && (
            <div className="card">
              <p className="note">
                {own.channelTitle} · {own.range.startDate} to {own.range.endDate} (YouTube Analytics data is about 2 days behind)
              </p>
              <div className="stats">
                <div><b>{num(own.totals.views)}</b><span>views</span></div>
                <div><b>{num(own.totals.likes)}</b><span>likes</span></div>
                <div><b>{num(own.totals.comments)}</b><span>comments</span></div>
                <div><b>{num(own.totals.estimatedMinutesWatched)}</b><span>minutes watched</span></div>
                <div><b>{mmss(own.totals.averageViewDuration)}</b><span>avg view duration</span></div>
                <div><b>{watched(own.totals.averageViewPercentage, 1)}</b><span>avg % watched</span></div>
                <div><b>{num(own.totals.subscribersGained)}</b><span>subscribers gained</span></div>
              </div>
              <div className="grid">
                <div><h4>What worked</h4><p>{own.insights.whatWorked}</p></div>
                <div><h4>What did not work</h4><p>{own.insights.whatDidNotWork}</p></div>
                <div><h4>What to repeat</h4><p>{own.insights.whatToRepeat}</p></div>
                <div><h4>What to change</h4><p>{own.insights.whatToChange}</p></div>
              </div>
              <details>
                <summary>Top videos</summary>
                <ul className="videos">
                  {own.videos.map((v) => (
                    <li key={v.id}>
                      <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer">{v.title}</a>
                      <span className="note">
                        {" "}· {num(v.views)} views · {num(v.likes)} likes · {num(v.comments)} comments · avg {mmss(v.averageViewDuration)} ({watched(v.averageViewPercentage, 0)})
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </section>

    </>
  );

  const recurPanel = (
    <>
        <section>
          <h2 className="section">Recurring / Returning Topics</h2>
          {returning.length === 0 && <p className="empty">No recurring or returning topics in this brief.</p>}
          {returning.map((c) => {
            const slices = weekPieSlices(c.weeklyCounts);
            const color = (weeksAgo) => `hsl(${(12 - weeksAgo) * 30} 65% 52%)`;
            const gradient = slices.length
              ? `conic-gradient(${slices.map((sl) => `${color(sl.weeksAgo)} ${sl.start}% ${sl.end}%`).join(", ")})`
              : "#e5e7eb";
            return (
              <div className="card" key={c.rank}>
                <div className="head">
                  <h3>{c.trendName}</h3>
                  <span className={`label ${c.label.toLowerCase()}`}>{c.label}</span>
                </div>
                <p className="note">Related videos per week, from 12 wks ago to last week (each slice is one week):</p>
                <div className="week-pie">
                  <div className="pie big-pie" style={{ background: gradient }} role="img" aria-label="Related videos by week" />
                  <ul className="week-legend">
                    {c.weeklyCounts.map((n, i) => {
                      const weeksAgo = c.weeklyCounts.length - i;
                      const biggest = Math.max(...c.weeklyCounts, 1);
                      return (
                        <li key={i}>
                          <span className="wk">
                            <i style={{ background: n > 0 ? color(weeksAgo) : "#d0d5dd" }} />
                            {weeksAgo === 1 ? "last week" : `${weeksAgo} wks ago`}
                          </span>
                          <span className="wtrack"><span className="wfill" style={{ width: `${(n / biggest) * 100}%`, background: color(weeksAgo) }} /></span>
                          <span className="wn">{n}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </section>

    </>
  );

  const pastPanel = (
    <>
        <section>
          <h2 className="section">Previous Briefs</h2>
          {past.length === 0 && <p className="empty">No briefs yet.</p>}
          <ul className="past">
            {past.map((b) => (
              <li key={b.id}>
                <Link href={`/?brief=${b.id}`}>{formatTime(b.created_at)}</Link>
                <span className="note"> · {triggerLabel(b.trigger)} · </span>
                <span className={b.status === "ok" ? "ok" : "bad"}>{b.status}</span>
              </li>
            ))}
          </ul>
          {viewingOld && <Link href="/">Back to latest</Link>}
        </section>
    </>
  );

  const settingsPanel = (
    <>
        <section>
          <h2 className="section">Settings</h2>
          <div className="card">
            <SettingsForm
              initialCategories={settings.categories}
              initialRegion={settings.region}
              regions={REGIONS}
              min={MIN_CATEGORIES}
              max={MAX_CATEGORIES}
            />
            <hr />
            <p className="note">Save your settings first, then press Generate Now (top right) to make a fresh brief from live YouTube data.</p>
          </div>
          <h2 className="section">Your channel</h2>
          <div className="card">
            {connected && <p className="note">Connected. Your next brief will include your channel.</p>}
            {connectError && <div className="error">{connectError}</div>}
            <p className="note">
              {connection ? `Connected: ${connection.channel_title}` : "Not connected. Read-only access to your channel and analytics."}
            </p>
            <a className="button secondary" href="/api/auth/google">
              {connection ? "Reconnect YouTube Channel" : "Connect YouTube Channel"}
            </a>
          </div>
        </section>
    </>
  );

  // Top bar: always visible.
  const header = (
    <header className="top">
      <div className="wrap topbar">
        <div className="topinfo">
          <h1>YouTube Trend Radar</h1>
          <p className="subtitle">Weekly content strategy brief for Ishaan</p>
          <p className="meta-line">
            {shown && shown.status === "ok" ? (
              <>
                Brief from {formatTime(shown.created_at)} · last {shown.window_days} days · region {shown.region}
                {" · "}
                <span className={shown.email_status === "failed" ? "bad" : ""}>Email: {emailStatusText(shown.email_status, shown.email_error)}</span>
              </>
            ) : (
              "No brief yet"
            )}
          </p>
        </div>
        <GenerateButton />
      </div>
    </header>
  );

  // Messages that stay visible above whichever tab is open.
  const banners = (
    <>
      {loadError && <div className="error">{loadError}</div>}
      {!viewingOld && latest && latest.status === "failed" && (
        <div className="error">
          The latest run ({formatTime(latest.created_at)}) failed: {latest.error}
          {shown && " Showing the last successful brief below."}
        </div>
      )}
      {viewingOld && (
        <p className="note oldnote">
          Viewing an older brief. <Link href="/">Back to latest</Link>
        </p>
      )}
      {shown && shown.status === "failed" && <div className="error">This run failed: {shown.error}</div>}
    </>
  );

  const tabs = [
    { id: "trends", label: "Trends", content: trendsPanel },
    { id: "india", label: "India Opportunity", content: indiaPanel },
    { id: "last7", label: "Your Last 7 Days", content: last7Panel },
    { id: "recurring", label: "Recurring / Returning", content: recurPanel },
    { id: "past", label: "Past Briefs", content: pastPanel },
    { id: "settings", label: "Settings", content: settingsPanel },
  ];

  // key: opening another brief (or going back to latest) starts again on the Trends tab.
  return <Tabs key={briefParam || "latest"} header={header} banners={banners} tabs={tabs} initial={initialTab} />;
}
