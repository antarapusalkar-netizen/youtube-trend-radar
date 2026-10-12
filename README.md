# YouTube Trend Radar

A weekly content strategy brief for Ishaan, a tech YouTube creator. It reads live YouTube data (global + one region),
asks OpenAI to group videos into 3-5 trend clusters, ranks them in code, saves the brief in Neon, shows it on one
dashboard page and emails it with Resend.

**Status: all 3 layers (core, 90-day history, own channel analytics).**

## Files (one line each)

| File | What it does |
|---|---|
| `app/page.js` | The one dashboard page (settings, clusters, India opportunity, previous briefs) |
| `app/SettingsForm.js` | Edit categories (3-5) and region, saves to `/api/settings` |
| `app/GenerateButton.js` | Generate Now button with loading state |
| `app/layout.js`, `app/globals.css` | Page shell and plain CSS |
| `app/api/generate/route.js` | Generate Now: calls `runPipeline("manual")` |
| `app/api/cron/generate/route.js` | Sunday cron: checks `CRON_SECRET`, calls `runPipeline("cron")` |
| `app/api/settings/route.js` | Validates and saves settings |
| `lib/pipeline.js` | The one shared pipeline: YouTube -> process -> OpenAI -> rank -> save -> email |
| `lib/youtube.js` | YouTube Data API calls (search, videos, channels) |
| `lib/process.js` | Pure functions: duration, Shorts removal, views per hour, India flag |
| `lib/ranking.js` | Pure functions: cluster numbers, 0-1 scaling, weighted score |
| `lib/history.js` | Pure functions: weekly counts and the New / Returning / Recurring / Growing label |
| `lib/google.js` | Google OAuth: sign-in URL, code and refresh-token exchange, own channel lookup |
| `lib/ownchannel.js` | Fetches "Your Last 7 Days" from YouTube Analytics and asks OpenAI to explain it |
| `lib/ownstats.js` | Pure functions: analytics date range, row parsing, "enough data" check |
| `app/api/auth/google/route.js` | Starts Google sign-in (Connect YouTube Channel) |
| `app/api/auth/google/callback/route.js` | Finishes sign-in and saves the channel and refresh token (server only) |
| `lib/validate.js` | Pure function: checks the OpenAI answer |
| `lib/openai.js` | The prompt and the OpenAI call (with one retry) |
| `lib/db.js` | Neon: creates tables, saves settings and briefs |
| `lib/email.js` | Builds and sends the email with Resend |
| `lib/config.js` | All constants (WINDOW_DAYS, weights, regions, default categories) |
| `lib/errors.js` | Friendly errors and the missing-env-variable check |
| `tests/*.test.js` | Unit tests for the pure functions (made-up inputs live only here) |
| `vercel.json` | Sunday cron: `30 0 * * 0` (00:30 UTC, about 6 AM IST) |

## Environment variables

Copy `.env.example` to `.env.local` and fill in:
`YOUTUBE_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Layer 3), `OPENAI_API_KEY`, `OPENAI_MODEL`,
`DATABASE_URL` (Neon), `RESEND_API_KEY`, `RESEND_FROM`, `BRIEF_EMAIL_TO`, `APP_URL`
(for example `http://localhost:3000`), `CRON_SECRET` (any long random text).

## Run locally and test

```bash
npm install
npm run dev      # open http://localhost:3000
npm test         # unit tests
npm run build
```

Live test: save settings, press **Generate Now**, wait about a minute. You should see clusters, the India
opportunity section and a new row in Previous Briefs, and get an email. Pressing the button again within 5 minutes
shows a friendly "please wait" message.

Test the cron route (it must reject a missing header):

```bash
curl -i http://localhost:3000/api/cron/generate                                   # 401
curl -i -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/generate
```

## Deploy on Vercel

1. Push the project to GitHub and import it in Vercel.
2. Add all environment variables (set `APP_URL` to the Vercel URL).
3. Deploy. The cron in `vercel.json` runs on Sunday; Vercel sends `Authorization: Bearer CRON_SECRET` automatically.
   On the free plan it may fire anywhere in that hour.

## Notes

- India creators are an approximation: a video counts as "India" if it came from the region search or its channel's
  country field is IN. Channels with no country are not counted.
- History: the first run (and the first run after adding a new category) does one 90-day search per category and
  source (50 results, Shorts removed) and saves it in Neon (`history_videos`). Later runs reuse it. The history search
  stops where the current 7-day window starts, so the two never overlap.
- After each successful run, that run's 7-day videos are also saved to `history_videos`, so history keeps growing
  and later weeks can be compared.
- Labels are fixed rules in `lib/config.js` (checked in order): New (fewer than 2 related past videos), Returning
  (related videos before, none in the last 4 weeks), Recurring (related videos in at least 4 of the last 12 weeks),
  otherwise Growing. OpenAI only says which past videos are related; code counts and labels.
- Public videos have no watch-time data, so "Watch quality" shows "Not available" and is not in the score.

## Google OAuth setup (for Connect YouTube Channel)

1. Go to https://console.cloud.google.com and use the same project as your YouTube API key.
2. APIs & Services -> Library: enable **YouTube Data API v3** and **YouTube Analytics API**.
3. APIs & Services -> OAuth consent screen: User type External, publishing status **Testing**.
   Under Test users, add your own Google account (the one that owns the YouTube channel).
4. Credentials -> Create credentials -> OAuth client ID -> Web application.
   Add Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback` and, after deploying,
   `https://YOUR-APP.vercel.app/api/auth/google/callback`. The redirect URI is always `APP_URL` + `/api/auth/google/callback`.
5. Put the client id and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. Open the dashboard and click **Connect YouTube Channel**. Google shows a "not verified" warning in Testing mode: continue.

Only read-only scopes are requested (`youtube.readonly`, `yt-analytics.readonly`). Only one channel is stored
(connecting again replaces it). Tokens stay on the server.

**Important:** while the Google app is in Testing mode, the refresh token expires after about 7 days. If
"Your Last 7 Days" shows that the connection expired, click Connect YouTube Channel again. Do this before any demo.

Your Last 7 Days uses data ending 2 days ago (Analytics lags). It needs at least 3 videos with views, otherwise it shows
"Not enough data".
