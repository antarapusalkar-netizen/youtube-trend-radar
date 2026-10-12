// Saves the region and categories.
import { saveSettings } from "@/lib/db.js";
import { REGIONS, MIN_CATEGORIES, MAX_CATEGORIES } from "@/lib/config.js";
import { friendlyMessage } from "@/lib/errors.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const categories = (Array.isArray(body.categories) ? body.categories : [])
      .map((c) => String(c).trim().slice(0, 100))
      .filter(Boolean);
    if (categories.length < MIN_CATEGORIES || categories.length > MAX_CATEGORIES) {
      return Response.json({ ok: false, message: `Keep between ${MIN_CATEGORIES} and ${MAX_CATEGORIES} categories.` }, { status: 400 });
    }
    if (!REGIONS.some((r) => r.code === body.region)) {
      return Response.json({ ok: false, message: "Please choose a region from the list." }, { status: 400 });
    }
    await saveSettings(body.region, categories);
    return Response.json({ ok: true, message: "Settings saved." });
  } catch (err) {
    return Response.json({ ok: false, message: friendlyMessage(err) }, { status: 500 });
  }
}
