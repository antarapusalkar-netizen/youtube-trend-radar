"use client";
// The frame: sticky blurred header (top bar + pill tabs) and the tab panels.
// All panels stay on the page (hidden or shown), so switching tabs never reloads or fetches data.
import { useState, useRef } from "react";

export default function Tabs({ top, banners, tabs, initial }) {
  const [active, setActive] = useState(initial || tabs[0].id);
  const buttons = useRef({});

  // Keyboard: arrow keys, Home and End move between tabs.
  function onKeyDown(e, i) {
    let next = null;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    setActive(tabs[next].id);
    if (buttons.current[tabs[next].id]) buttons.current[tabs[next].id].focus();
  }

  // Any element with data-goto="tabId" (for example "Go to Settings") switches to that tab.
  function onMainClick(e) {
    const target = e.target.closest ? e.target.closest("[data-goto]") : null;
    if (target) setActive(target.getAttribute("data-goto"));
  }

  return (
    <div className="frame">
      <header className="hdr">
        <div className="hdr-in">
          {top}
          <nav role="tablist" aria-label="Dashboard sections" className="tray">
            {tabs.map((t, i) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={active === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={active === t.id ? 0 : -1}
                className="tab"
                onClick={() => setActive(t.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                ref={(el) => (buttons.current[t.id] = el)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="main" onClick={onMainClick}>
        {banners}
        {tabs.map((t) => (
          <section key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={active !== t.id} className="panel">
            {t.content}
          </section>
        ))}
      </main>
    </div>
  );
}
