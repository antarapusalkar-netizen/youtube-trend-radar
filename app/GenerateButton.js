"use client";
// Generate Now: runs the pipeline and shows a loading state (it can take about a minute).
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
    <div className="row">
      <button className="big" onClick={generate} disabled={loading}>
        {loading ? "Generating... (about a minute)" : "Generate Now"}
      </button>
      {message && <span className="note">{message}</span>}
    </div>
  );
}
