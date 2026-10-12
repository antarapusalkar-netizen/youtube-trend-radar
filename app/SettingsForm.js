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

  const edit = (i, value) => setCategories(categories.map((c, j) => (j === i ? value : c)));
  const remove = (i) => setCategories(categories.filter((_, j) => j !== i));

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
    <div>
      <h3>Categories ({min}-{max})</h3>
      {categories.map((c, i) => (
        <div className="row" key={i}>
          <input value={c} onChange={(e) => edit(i, e.target.value)} aria-label={`Category ${i + 1}`} />
          <button className="secondary" onClick={() => remove(i)} disabled={categories.length <= min}>
            Remove
          </button>
        </div>
      ))}
      <button className="secondary" onClick={() => setCategories([...categories, ""])} disabled={categories.length >= max}>
        Add category
      </button>

      <h3>Market / region</h3>
      <select value={region} onChange={(e) => setRegion(e.target.value)}>
        {regions.map((r) => (
          <option key={r.code} value={r.code}>
            {r.name} ({r.code})
          </option>
        ))}
      </select>

      <div className="row">
        <button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </button>
        {message && <span className="note">{message}</span>}
      </div>
    </div>
  );
}
