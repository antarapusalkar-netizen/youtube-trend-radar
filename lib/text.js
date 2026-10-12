// Pure helper: OpenAI refers to videos by id. For display, swap each id for the video's short title.
export function replaceIds(text, idToTitle, maxLength = 45) {
  let out = text;
  for (const [id, title] of Object.entries(idToTitle)) {
    const short = title.length > maxLength ? title.slice(0, maxLength).trim() + "…" : title;
    out = out.split(id).join(`“${short}”`);
  }
  return out;
}

// Label shown in the Previous Briefs list.
export function triggerLabel(trigger) {
  return trigger === "cron" ? "Scheduled run" : "Generate Now";
}

// One small line about the email: Sent / Failed: reason / Not attempted.
export function emailStatusText(status, error) {
  if (status === "sent") return "Sent";
  if (status === "failed") return `Failed: ${error || "unknown reason"}`;
  return "Not attempted";
}
