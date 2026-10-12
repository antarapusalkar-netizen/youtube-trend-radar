// "Connect YouTube Channel" starts here: send the user to Google's sign-in page.
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { buildAuthUrl } from "@/lib/google.js";
import { friendlyMessage } from "@/lib/errors.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    // A random value we check again on return, so nobody else can complete the sign-in.
    const state = randomBytes(16).toString("hex");
    const jar = await cookies();
    jar.set("oauth_state", state, { httpOnly: true, maxAge: 600, path: "/", sameSite: "lax" });
    return Response.redirect(buildAuthUrl(state));
  } catch (err) {
    const url = new URL("/", request.url);
    url.searchParams.set("connect_error", friendlyMessage(err));
    return Response.redirect(url);
  }
}
