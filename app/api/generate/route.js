// Generate Now button calls this route.
import { runPipeline } from "@/lib/pipeline.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const result = await runPipeline("manual");
  return Response.json(result, { status: result.rateLimited ? 429 : 200 });
}
