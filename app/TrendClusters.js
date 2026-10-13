"use client";
// Trends tab: the overview cards and the collapsible cluster cards.
// Clicking an overview card (or "Show details") opens or closes that cluster. Everything shown is real brief data.
import { useState } from "react";
import { Chip, num, pct1 } from "./ui.js";

const WORDS = ["", "One", "Two", "Three", "Four", "Five"];
const BLOCKS = [
  ["Why it matters now", "whyItMattersNow"],
  ["What creators are doing", "whatCreatorsAreDoing"],
  ["Formats used", "formatsUsed"],
  ["Engagement signals", "engagementSignals"],
  ["Global context", "globalContext"],
  ["India context", "indiaContext"],
];
// The six numbers on each card. Each small bar compares this cluster with the others.
const STATS = [
  { label: "Views per hour", get: (c) => c.measures.momentum, fmt: (v) => num(Math.round(v)) },
  { label: "Total views", get: (c) => c.measures.views, fmt: num },
  { label: "Engagement", get: (c) => c.measures.engagement, fmt: pct1 },
  { label: "Creators", get: (c) => c.measures.breadth, fmt: num },
  { label: "Watch quality", na: true },
  { label: "Score", get: (c) => c.score, fmt: (v) => v.toFixed(2) },
];

export default function TrendClusters({ clusters, scoreLine }) {
  const [open, setOpen] = useState({ 0: true });
  const toggle = (i) => setOpen((p) => ({ ...p, [i]: !p[i] }));
  const count = WORDS[clusters.length] || String(clusters.length);

  return (
    <>
      <h2 className="hero">
        <span>This week&apos;s trends.</span>
        <span>
          {count} {clusters.length === 1 ? "cluster" : "clusters"}, ranked by score.
        </span>
      </h2>

      <div className="overview">
        {clusters.map((c, i) => (
          <button key={c.rank} type="button" className={`ocard${open[i] ? " open" : ""}`} onClick={() => toggle(i)} aria-expanded={!!open[i]} aria-controls={`cluster-${i}`}>
            <span className="row">
              <span className="rank">{c.rank}</span>
              <Chip label={c.label} />
            </span>
            <span className="name">{c.trendName}</span>
            <span className="score">
              <span className="row">
                <span>Score</span>
                <b>{c.score.toFixed(2)}</b>
              </span>
              <span className="track">
                <span className="fill" style={{ width: `${Math.min(100, c.score * 100)}%` }} />
              </span>
            </span>
          </button>
        ))}
      </div>

      {clusters.map((c, i) => (
        <article className="card cluster" key={c.rank} id={`cluster-${i}`}>
          <div className="cluster-head">
            <div className="cluster-title">
              <span className="rank">{c.rank}</span>
              <h3>{c.trendName}</h3>
            </div>
            {c.label && (
              <div className="indent">
                <Chip label={c.label} />
              </div>
            )}
            <p className="lede">{c.whatIsHappening}</p>
            <button type="button" className="toggle" onClick={() => toggle(i)} aria-expanded={!!open[i]} aria-controls={`details-${i}`}>
              {open[i] ? "Hide details" : "Show details"}
            </button>
          </div>

          <div className={`collapse${open[i] ? " open" : ""}`} id={`details-${i}`} inert={!open[i]}>
            <div>
              <div className="collapse-in">
                <div className="blocks">
                  {BLOCKS.map(([label, key]) => (
                    <div className="block" key={key}>
                      <h4>{label}</h4>
                      <p>{c[key]}</p>
                    </div>
                  ))}
                </div>

                <div className="dark">
                  <div>
                    <h4>Opportunity for Ishaan</h4>
                    <p>{c.opportunityForIshaan}</p>
                  </div>
                  <div>
                    <h4>Suggested content angle</h4>
                    <p>{c.suggestedContentAngle}</p>
                  </div>
                </div>

                <div className="stats stats6 panelbg">
                  {STATS.map((s) => {
                    if (s.na) {
                      return (
                        <div className="stat" key={s.label}>
                          <b className="na">N/A</b>
                          <span>{s.label}</span>
                        </div>
                      );
                    }
                    const max = Math.max(...clusters.map(s.get), 0) || 1;
                    return (
                      <div className="stat" key={s.label}>
                        <b>{s.fmt(s.get(c))}</b>
                        <span>{s.label}</span>
                        <div className="minibars">
                          {clusters.map((k, j) => (
                            <div key={k.rank} title={`${k.trendName}: ${s.fmt(s.get(k))}`} style={{ height: `${(s.get(k) / max) * 100}%`, background: j === i ? "#2BAFE3" : "#DCE3EA" }} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <details>
                  <summary>
                    {c.videos.length} {c.videos.length === 1 ? "video" : "videos"} in this cluster
                  </summary>
                  <div className="vids">
                    {c.videos.map((v) => (
                      <div key={v.id}>
                        <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer">
                          {v.title}
                        </a>
                        <span>
                          {v.channelName} · {num(v.views)} views
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          </div>
        </article>
      ))}

      <p className="fine">{scoreLine}</p>
    </>
  );
}
