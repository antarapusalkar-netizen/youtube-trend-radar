// Pure helper: OpenAI refers to videos by id. For display, swap each id for the video's short title.
export function replaceIds(text, idToTitle, maxLength = 45) {
  let out = text;
  for (const [id, title] of Object.entries(idToTitle)) {
    const short = title.length > maxLength ? title.slice(0, maxLength).trim() + "…" : title;
    out = out.split(id).join(`“${short}”`);
  }
  return out;
}
