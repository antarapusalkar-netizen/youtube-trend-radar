"use client";
// Tabs for the one dashboard page. All panels stay on the page (hidden or shown),
// so switching tabs never reloads the page or fetches data again.
import { useState, useRef } from "react";

export default function Tabs({ header, banners, tabs, initial }) {
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

  return (
    <>
      <div className="sticky-top">
        {header}
        <div className="tabbar">
          <div className="wrap">
            <div role="tablist" aria-label="Dashboard sections" className="tablist">
              {tabs.map((t, i) => (
                <button
                  key={t.id}
                  id={`tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active === t.id}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={active === t.id ? 0 : -1}
                  className={`tab${active === t.id ? " active" : ""}`}
                  onClick={() => setActive(t.id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  ref={(el) => (buttons.current[t.id] = el)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <main className="wrap">
        {banners}
        {tabs.map((t) => (
          <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={active !== t.id} className="panel">
            {t.content}
          </div>
        ))}
      </main>
    </>
  );
}
