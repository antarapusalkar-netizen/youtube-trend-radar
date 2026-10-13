"use client";
// Generate Now: runs the pipeline and shows a spinner and a progress line (it can take about a minute).
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function generate() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/generate", { method: "POST" });
      const data = await res.json();
      setMessage(data.message);
    } catch {
      setMessage("The request took too long or failed. Refresh the page to see if the brief was saved.");
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="gen">
      <button className="gen-btn" onClick={generate} disabled={loading}>
        {loading && <span className="spinner" aria-hidden="true" />}
        {loading ? "Generating" : "Generate Now"}
      </button>
      {loading && <span className="gen-note">Fetching videos and analysing, this takes about a minute...</span>}
      {message && (
        <span className="gen-note" role="status">
          {message}
        </span>
      )}
    </div>
  );
}
