// Google sends the user back here with a code. We save the channel and its refresh token (server only).
import { cookies } from "next/headers";
import { exchangeCode, fetchMyChannel } from "@/lib/google.js";
import { saveConnection } from "@/lib/db.js";
import { UserError, friendlyMessage } from "@/lib/errors.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const home = new URL("/", process.env.APP_URL || request.url);
  try {
    const params = new URL(request.url).searchParams;
    if (params.get("error")) throw new UserError("Google sign-in was cancelled or refused.");

    const jar = await cookies();
    const savedState = jar.get("oauth_state")?.value;
    if (!savedState || savedState !== params.get("state")) throw new UserError("Google sign-in check failed. Please try connecting again.");
    jar.delete("oauth_state");

    const tokens = await exchangeCode(params.get("code"));
    if (!tokens.refresh_token) throw new UserError("Google did not give a refresh token. Remove the app at myaccount.google.com/permissions and connect again.");

    const channel = await fetchMyChannel(tokens.access_token);
    await saveConnection(channel.id, channel.title, tokens.refresh_token);
    home.searchParams.set("connected", "1");
  } catch (err) {
    home.searchParams.set("connect_error", friendlyMessage(err));
  }
  return Response.redirect(home);
}
