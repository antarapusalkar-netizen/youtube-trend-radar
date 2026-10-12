// Vercel calls this every Sunday. Only requests with the right secret are allowed.
import { runPipeline } from "@/lib/pipeline.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const result = await runPipeline("cron");
  return Response.json(result);
}
