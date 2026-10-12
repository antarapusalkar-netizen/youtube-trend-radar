// Google OAuth: only used to connect Ishaan's YouTube channel (read-only access).
import { UserError, requireEnv } from "./errors.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export function redirectUri() {
  return process.env.APP_URL.replace(/\/$/, "") + "/api/auth/google/callback";
}

// access_type=offline + prompt=consent makes Google give us a refresh token.
export function buildAuthUrl(state) {
  requireEnv(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "APP_URL"]);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function tokenRequest(params, failMessage) {
  requireEnv(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "APP_URL"]);
  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...params }),
    });
  } catch {
    throw new UserError("Could not reach Google. Try again.");
  }
  if (!res.ok) throw new UserError(failMessage);
  return res.json();
}

// After sign-in: swap the one-time code for tokens.
export function exchangeCode(code) {
  return tokenRequest(
    { code, grant_type: "authorization_code", redirect_uri: redirectUri() },
    "Google sign-in failed. Check the OAuth client and that the redirect URI matches exactly."
  );
}

// Short-lived access token from the saved refresh token.
export async function getAccessToken(refreshToken) {
  const data = await tokenRequest(
    { refresh_token: refreshToken, grant_type: "refresh_token" },
    "The Google connection has expired or was removed. Click Connect YouTube Channel again."
  );
  return data.access_token;
}

// The signed-in user's own channel (id and title).
export async function fetchMyChannel(accessToken) {
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new UserError("Could not read your YouTube channel. Make sure the YouTube Data API is enabled.");
  const item = ((await res.json()).items || [])[0];
  if (!item) throw new UserError("This Google account has no YouTube channel.");
  return { id: item.id, title: item.snippet.title };
}
