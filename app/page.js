// The one dashboard page. A sticky top bar plus tabs (the tabs switch in the browser, nothing is re-fetched).
// The page reads the data on the server; only the small interactive parts are client components.
import Link from "next/link";
import SettingsForm from "./SettingsForm";
import GenerateButton from "./GenerateButton";
import Tabs from "./Tabs";
import TrendClusters from "./TrendClusters";
import { Chip, num, pct0, mmss, watched } from "./ui.js";
import { getSettings, getBrief, getLatestBrief, listBriefs, getConnectionInfo } from "@/lib/db.js";
import { WEIGHTS, REGIONS, MIN_CATEGORIES, MAX_CATEGORIES, DEFAULT_CATEGORIES, DEFAULT_REGION } from "@/lib/config.js";
import { friendlyMessage } from "@/lib/errors.js";
import { triggerLabel, emailStatusText, scoreExplanation } from "@/lib/text.js";
import { notEnoughDataText } from "@/lib/ownstats.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// All times are shown in India time.
const formatTime = (d) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const formatDay = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

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

  const emptyBig = (
    <div className="empty-big">
      <b>No brief yet</b>
      <span>Press Generate Now to create the first brief. It takes about a minute. After that, a new one arrives every Sunday morning and by email.</span>
    </div>
  );

  // ---- Tab 1: Trends ----
  const trendsPanel = clusters.length === 0 ? emptyBig : <TrendClusters clusters={clusters} scoreLine={scoreExplanation(WEIGHTS)} />;

  // ---- Tab 2: India Opportunity ----
  const indiaPanel = (
    <>
      <div className="india-top">
        <p className="fine">
          India is decided only from each video’s YouTube channel country field (country = IN). Channels with no country set are counted as unknown, not as India. The search region is never used. This is an approximation.
        </p>
        <div className="legend-row">
          <span><i style={{ background: "#2BAFE3" }} />India</span>
          <span><i style={{ background: "#A5B4FC" }} />Other countries</span>
          <span><i style={{ background: "#EEF1F4" }} />Unknown</span>
        </div>
      </div>
      {indiaSorted.length === 0 && (
        <div className="empty-box">
          <b>Nothing here yet</b>
          <span>Shows up once a brief exists.</span>
        </div>
      )}
      {indiaSorted.map((c) => {
        const m = c.measures;
        const hasCounts = m.unknownCount !== undefined;
        const total = hasCounts ? m.indiaCount + m.otherCount + m.unknownCount : 0;
        const share = (n) => (total ? (n / total) * 100 : 0);
        const a = share(m.indiaCount);
        const b = a + share(m.otherCount);
        return (
          <article className="card india-card" key={c.rank}>
            <div className="pctbox">
              <b>{pct0(m.indiaOpportunity)}</b>
              <span>India opportunity</span>
              {hasCounts && (
                <div className="ring" role="img" aria-label={`${m.indiaCount} India, ${m.otherCount} other countries, ${m.unknownCount} unknown`}>
                  <div className="ring-fill" style={{ background: `conic-gradient(#2BAFE3 0 ${a}%, #A5B4FC ${a}% ${b}%, #E5E7EB ${b}% 100%)` }} />
                  <div className="ring-mid"><b>{total}</b><span>videos</span></div>
                </div>
              )}
            </div>
            <div className="india-body">
              <h3>{c.trendName}</h3>
              {hasCounts ? (
                <div>
                  <div className="split">
                    <div style={{ width: `${share(m.indiaCount)}%`, background: "#2BAFE3" }} />
                    <div style={{ width: `${share(m.otherCount)}%`, background: "#A5B4FC" }} />
                    <div style={{ width: `${share(m.unknownCount)}%`, background: "#EEF1F4" }} />
                  </div>
                  <div className="counts">
                    <span>India {m.indiaCount}</span>
                    <span>Other countries {m.otherCount}</span>
                    <span>Country unknown {m.unknownCount}</span>
                    <span>of {total} videos</span>
                  </div>
                </div>
              ) : (
                <p className="fine">Older brief: India counts were made with a different rule and are not shown.</p>
              )}
              <p>{c.opportunityForIshaan}</p>
            </div>
          </article>
        );
      })}
    </>
  );

  // ---- Tab 3: Your Last 7 Days ----
  const last7Panel = (
    <>
      {(!own || own.status === "not_connected") && (
        <div className="empty-box">
          <b>Your channel is not connected.</b>
          <span>
            Use the Connect YouTube Channel button in Settings, then generate a new brief.{" "}
            <button type="button" className="linkbtn" data-goto="settings">Go to Settings</button>
          </span>
        </div>
      )}
      {own && own.status === "not_enough_data" && (
        <div className="empty-box">
          <b>Not enough data yet.</b>
          <span>{notEnoughDataText(own.usableVideos)}</span>
        </div>
      )}
      {own && own.status === "error" && (
        <div className="alert" role="alert">
          <span>{own.message}</span>
          <button type="button" className="linkbtn" data-goto="settings">Go to Settings</button>
        </div>
      )}
      {own && own.status === "ok" && (
        <>
          <div className="who">
            <b>{own.channelTitle}</b>
            <span>{formatDay(own.range.startDate)} – {formatDay(own.range.endDate)} · data ends 2 days ago</span>
          </div>
          <article className="card">
            <div className="stats stats7">
              <div className="stat"><b>{num(own.totals.views)}</b><span>Views</span></div>
              <div className="stat"><b>{num(own.totals.likes)}</b><span>Likes</span></div>
              <div className="stat"><b>{num(own.totals.comments)}</b><span>Comments</span></div>
              <div className="stat"><b>{num(own.totals.estimatedMinutesWatched)}</b><span>Minutes watched</span></div>
              <div className="stat"><b>{mmss(own.totals.averageViewDuration)}</b><span>Avg view duration</span></div>
              <div className="stat"><b>{watched(own.totals.averageViewPercentage, 1)}</b><span>Avg % watched</span></div>
              <div className="stat"><b>{num(own.totals.subscribersGained)}</b><span>Subscribers gained</span></div>
            </div>
            <div className="blocks two divider">
              <div className="block"><h4>What worked</h4><p>{own.insights.whatWorked}</p></div>
              <div className="block"><h4>What did not work</h4><p>{own.insights.whatDidNotWork}</p></div>
              <div className="block"><h4>What to repeat</h4><p>{own.insights.whatToRepeat}</p></div>
              <div className="block"><h4>What to change</h4><p>{own.insights.whatToChange}</p></div>
            </div>
            <details>
              <summary>Top videos</summary>
              <div className="vids">
                {own.videos.map((v) => (
                  <div key={v.id}>
                    <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer">{v.title}</a>
                    <span>
                      {num(v.views)} views · {num(v.likes)} likes · {num(v.comments)} comments · avg {mmss(v.averageViewDuration)} ({watched(v.averageViewPercentage, 0)})
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </article>
        </>
      )}
    </>
  );

  // ---- Tab 4: Recurring / Returning ----
  const recurPanel =
    returning.length === 0 ? (
      <div className="empty-box">
        <b>Nothing recurring this week</b>
        <span>No recurring or returning topics in this brief.</span>
      </div>
    ) : (
      <div className="rec-grid">
        {returning.map((c) => {
          const counts = c.weeklyCounts;
          const max = Math.max(...counts, 1);
          const total = counts.reduce((a, b) => a + b, 0);
          return (
            <article className="card tight" key={c.rank}>
              <div className="rec-head">
                <h3>{c.trendName}</h3>
                <div>
                  <Chip label={c.label} />
                  {total} related videos in {counts.length} weeks
                </div>
              </div>
              <div>
                <div className="weeks12" role="img" aria-label="Related videos per week, from 12 weeks ago to last week">
                  {counts.map((n, i) => {
                    const weeksAgo = counts.length - i;
                    return (
                      <div className="wcol" key={i} title={`${weeksAgo === 1 ? "last week" : `${weeksAgo} wks ago`}: ${n}`}>
                        <span className="wcount">{n}</span>
                        <div className="wbar" style={{ height: n ? `calc((100% - 18px) * ${n / max})` : "2px", background: i === counts.length - 1 ? "#2BAFE3" : "#BAE6FD", animationDelay: `${i * 40}ms` }} />
                      </div>
                    );
                  })}
                </div>
                <div className="axis">
                  <span>{counts.length} wks ago</span>
                  <span>last week</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );

  // ---- Tab 5: Past Briefs ----
  const pastPanel =
    past.length === 0 ? (
      <div className="empty-box">
        <b>No briefs yet</b>
        <span>Past briefs appear here after the first run.</span>
      </div>
    ) : (
      <div className="past">
        {past.map((b) => (
          <Link href={`/?brief=${b.id}`} className="prow" key={b.id}>
            <span className="d">{formatTime(b.created_at)}</span>
            <span className="t">{triggerLabel(b.trigger)}</span>
            <span className={`s${b.status === "ok" ? "" : " bad"}`}>{b.status === "ok" ? "Completed" : "Failed"}</span>
            <span className="o">{shown && shown.id === b.id ? "Open" : ""}</span>
          </Link>
        ))}
      </div>
    );

  // ---- Tab 6: Settings ----
  const settingsPanel = (
    <div className="set-grid">
      <SettingsForm
        initialCategories={settings.categories}
        initialRegion={settings.region}
        regions={REGIONS}
        min={MIN_CATEGORIES}
        max={MAX_CATEGORIES}
      />
      <article className="card tight">
        <div className="field-title">YouTube connection</div>
        {connected && <p className="fine">Connected. Your next brief will include your channel.</p>}
        {connectError && <div className="alert" role="alert">{connectError}</div>}
        <p>{connection ? `Connected: ${connection.channel_title}` : <span style={{ color: "#6B7280" }}>Not connected</span>}</p>
        {!connection && <p className="fine">Read-only access to your channel and analytics.</p>}
        <a className={`pill${connection ? " soft" : ""}`} href="/api/auth/google">
          {connection ? "Reconnect YouTube Channel" : "Connect YouTube Channel"}
        </a>
      </article>
    </div>
  );

  // ---- Top bar (always visible) ----
  const top = (
    <div className="top-row">
      <div className="title-block">
        <div className="brand">YouTube Trend Radar<i>.</i></div>
        <div className="sub">Weekly content strategy brief for Ishaan</div>
        <div className="meta">
          {shown && shown.status === "ok" ? (
            <>
              Brief from {formatTime(shown.created_at)} · last {shown.window_days} days · region {shown.region}
              {" · "}
              <span className={shown.email_status === "failed" ? "bad" : ""}>Email: {emailStatusText(shown.email_status, shown.email_error)}</span>
            </>
          ) : (
            "No brief yet"
          )}
        </div>
      </div>
      <GenerateButton />
    </div>
  );

  // Messages that stay visible above whichever tab is open.
  const hasNotices = loadError || viewingOld || (!viewingOld && latest && latest.status === "failed") || (shown && shown.status === "failed");
  const banners = hasNotices ? (
    <div className="notices">
      {loadError && <div className="alert" role="alert">{loadError}</div>}
      {!viewingOld && latest && latest.status === "failed" && (
        <div className="alert" role="alert">
          The latest run ({formatTime(latest.created_at)}) failed: {latest.error}
          {shown && " Showing the last successful brief below."}
        </div>
      )}
      {viewingOld && (
        <div className="notice">
          <span>Viewing an older brief{shown ? `: ${formatTime(shown.created_at)}` : ""}</span>
          <Link href="/">Back to latest</Link>
        </div>
      )}
      {shown && shown.status === "failed" && <div className="alert" role="alert">This run failed: {shown.error}</div>}
    </div>
  ) : null;

  const tabs = [
    { id: "trends", label: "Trends", content: trendsPanel },
    { id: "india", label: "India Opportunity", content: indiaPanel },
    { id: "last7", label: "Your Last 7 Days", content: last7Panel },
    { id: "recurring", label: "Recurring / Returning", content: recurPanel },
    { id: "past", label: "Past Briefs", content: pastPanel },
    { id: "settings", label: "Settings", content: settingsPanel },
  ];

  // key: opening another brief (or going back to latest) starts again on the Trends tab.
  return <Tabs key={briefParam || "latest"} top={top} banners={banners} tabs={tabs} initial={initialTab} />;
}
