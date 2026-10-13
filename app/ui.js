// Small display helpers shared by the page and the client components (no data logic here).

export const num = (n) => (n === undefined || n === null || Number.isNaN(Number(n)) ? "-" : Number(n).toLocaleString("en-US"));
export const pct1 = (n) => `${(n * 100).toFixed(1)}%`;
export const pct0 = (n) => `${Math.round(n * 100)}%`;
export const mmss = (sec) =>
  sec === undefined || sec === null || Number.isNaN(Number(sec)) ? "-" : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
export const watched = (n, digits) => (n === undefined || n === null || Number.isNaN(Number(n)) ? "-" : `${Number(n).toFixed(digits)}%`);

// Status label colours: New blue, Growing green, Recurring amber, Returning violet.
export const CHIP = {
  New: { bg: "#E6F6FD", fg: "#0B6E99" },
  Growing: { bg: "#E7F7EE", fg: "#15803D" },
  Recurring: { bg: "#FEF3E2", fg: "#B45309" },
  Returning: { bg: "#F1ECFD", fg: "#6D28D9" },
};

export function Chip({ label }) {
  if (!label) return null;
  const c = CHIP[label] || { bg: "#F1F5F9", fg: "#374151" };
  return (
    <span className="chip" style={{ background: c.bg, color: c.fg }}>
      {label}
    </span>
  );
}
