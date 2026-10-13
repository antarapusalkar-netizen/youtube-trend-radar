"use client";
// Edit categories (3-5) and choose the region. Saved in Neon through /api/settings.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsForm({ initialCategories, initialRegion, regions, min, max }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [region, setRegion] = useState(initialRegion);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const edit = (i, value) => {
    setCategories(categories.map((c, j) => (j === i ? value : c)));
    setMessage("");
  };
  const remove = (i) => {
    setCategories(categories.filter((_, j) => j !== i));
    setMessage("");
  };

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, categories }),
      });
      const data = await res.json();
      setMessage(data.message);
      if (data.ok) router.refresh();
    } catch {
      setMessage("Could not save. Check your connection and try again.");
    }
    setSaving(false);
  }

  return (
    <article className="card tight">
      <div>
        <div className="field-title">Categories</div>
        <div className="fine">
          {min} to {max} categories · {categories.length} in use
        </div>
      </div>
      <div className="cat-rows">
        {categories.map((c, i) => (
          <div className="cat-row" key={i}>
            <input className="input" value={c} onChange={(e) => edit(i, e.target.value)} aria-label={`Category ${i + 1}`} />
            <button type="button" className="textbtn" onClick={() => remove(i)} disabled={categories.length <= min}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="addbtn" onClick={() => setCategories([...categories, ""])} disabled={categories.length >= max}>
        Add category
      </button>

      <label className="region">
        <span>Market / region</span>
        <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
          {regions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name} ({r.code})
            </option>
          ))}
        </select>
      </label>

      <div className="save-row">
        <button type="button" className="pill" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </button>
        {message && <span role="status">{message}</span>}
      </div>
      <div className="fine">Save your settings first, then press Generate Now to make a fresh brief from live YouTube data.</div>
    </article>
  );
}
