# YouTube Trend Radar

A weekly content strategy brief for Ishaan, a tech YouTube creator. It reads live YouTube data (global + one region),
asks OpenAI to group videos into 3-5 trend clusters, ranks them in code, compares them with 90 days of saved history,
reviews Ishaan's own channel, saves the brief in Neon, shows it on one dashboard page and emails it with Resend.

## Files (one line each)

| File | What it does |
|---|---|
| `app/page.js` | The one dashboard page (settings, clusters, India opportunity, own channel, recurring topics, previous briefs) |
| `app/SettingsForm.js` | Edit categories (3-5) and region, saves to `/api/settings` |
| `app/GenerateButton.js` | Generate Now button with loading state |
| `app/layout.js`, `app/globals.css` | Page shell and plain CSS |
| `app/api/generate/route.js` | Generate Now: calls `runPipeline("manual")` |
| `app/api/cron/generate/route.js` | Scheduled run: checks `CRON_SECRET`, calls `runPipeline("cron")` |
| `app/api/settings/route.js` | Validates and saves settings |
| `app/api/auth/google/route.js` | Starts Google sign-in (Connect YouTube Channel) |
| `app/api/auth/google/callback/route.js` | Finishes sign-in, saves the channel and refresh token (server only) |
| `lib/pipeline.js` | The one shared pipeline: YouTube -> process -> OpenAI -> rank -> save -> email |
| `lib/youtube.js` | YouTube Data API calls (search, videos, channels) |
| `lib/ytErrors.js` | Pure: turns YouTube errors into friendly messages (including the quota message) |
| `lib/process.js` | Pure: duration, Shorts removal, views per hour, India flag |
| `lib/ranking.js` | Pure: cluster numbers (India / other / unknown counts), 0-1 scaling, weighted score |
| `lib/history.js` | Pure: weekly counts and the New / Returning / Recurring / Growing label |
| `lib/validate.js` | Pure: checks the OpenAI answer (3+ videos per cluster, India wording vs coded counts) |
| `lib/aiparams.js` | Pure: reasoning effort "low", dropped automatically if the model rejects it |
| `lib/openai.js` | The prompts and the OpenAI calls (one retry on an invalid answer) |
| `lib/google.js` | Google OAuth: sign-in URL, token exchange, own channel lookup |
| `lib/ownchannel.js` | "Your Last 7 Days": YouTube Analytics numbers, OpenAI explains them |
| `lib/ownstats.js` | Pure: analytics date range, row parsing, "enough data" check and message |
| `lib/db.js` | Neon: creates tables, saves settings, briefs, history, channel connection |
| `lib/email.js` | Builds and sends the email with Resend |
| `lib/text.js` | Pure: id-to-title replacement, trigger label, email status text, score explanation |
| `lib/config.js` | All constants (WINDOW_DAYS, weights, label rules, regions, default categories) |
| `lib/errors.js` | Friendly errors and the missing-environment-variable check |
| `tests/*.test.js` | Unit tests for the pure functions (small made-up inputs live only here) |
| `vercel.json` | The scheduled run: `30 0 * * 0` (Sunday 00:30 UTC, about 6 AM IST) |

## Environment variables

Copy `.env.example` to `.env.local` and fill in every value. `.env*` is git-ignored, so secrets are never committed.

| Variable | What it is |
|---|---|
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client (to connect Ishaan's channel) |
| `OPENAI_API_KEY` | OpenAI key |
| `OPENAI_MODEL` | Model name to use (never hard-coded) |
| `DATABASE_URL` | Neon connection string |
| `RESEND_API_KEY`, `RESEND_FROM` | Resend key and the sender address |
| `BRIEF_EMAIL_TO` | Where the brief is emailed |
| `APP_URL` | Address of the app, no trailing slash (`http://localhost:3000` locally) |
| `CRON_SECRET` | Any long random text; the scheduled route requires it |

## Local setup and run

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                    # open http://localhost:3000
npm test                       # unit tests
npm run build
```

## Google OAuth setup (Connect YouTube Channel)

1. In https://console.cloud.google.com use the same project as your YouTube API key.
2. APIs & Services -> Library: enable **YouTube Data API v3** and **YouTube Analytics API**.
3. Google Auth Platform (OAuth consent screen): audience **External**, publishing status **Testing**.
   Under Test users add your own Google account (the one that owns the YouTube channel).
4. Clients -> Create client -> **Web application**. Under **Authorized redirect URIs** add
   `http://localhost:3000/api/auth/google/callback` and, after deploying, `https://YOUR-APP.vercel.app/api/auth/google/callback`.
   (Do not put these in "Authorized JavaScript origins".) The redirect URI is always `APP_URL` + `/api/auth/google/callback`.
5. Put the client id and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. On the dashboard click **Connect YouTube Channel**. Google shows a "not verified" warning in Testing mode:
   choose Advanced, then continue.

Only read-only scopes are requested (`youtube.readonly`, `yt-analytics.readonly`). Only one channel is stored
(connecting again replaces it). Tokens stay on the server.

**Testing-mode note:** while the Google app is in Testing mode, the refresh token expires after about 7 days. If the
dashboard says the connection expired, click Connect YouTube Channel again. Do this before any demo.

## Vercel setup

1. Push the repository to GitHub and import it in Vercel (Framework: Next.js, nothing else to change).
2. Settings -> Environment Variables: add all 11 variables above for Production. Set `APP_URL` to the project's
   production address (no trailing slash) and keep `CRON_SECRET` private.
3. Deploy. Then add the deployed redirect URI to the Google OAuth client (step 4 above) and click Connect again on the live site.
4. Re-deploy after changing any environment variable (they are read at deploy time).

## Scheduled (Sunday) run

`vercel.json` has one cron: `/api/cron/generate` at `30 0 * * 0` (Sunday 00:30 UTC, about 6 AM IST; on the free plan
Vercel may fire it anywhere in that hour). Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically; the route
rejects any request without it. It uses the same `runPipeline` as Generate Now and shows as "Scheduled run".

## Testing

- **Unit tests:** `npm test` (no network; only small made-up inputs inside the test files).
- **Generate Now:** save settings, press **Generate Now**, wait about a minute. You should see ranked clusters, the
  India Opportunity section, a new row in Previous Briefs and an email line ("Email: Sent"). Pressing it again within
  5 minutes shows a friendly "please wait" message.
- **Cron route:**
  ```bash
  curl -i https://YOUR-APP.vercel.app/api/cron/generate                                        # 401
  curl -i -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-APP.vercel.app/api/cron/generate   # runs a brief
  ```

## Deployment verification

1. The site loads and shows the dashboard (or a friendly message naming any missing variables).
2. `/api/cron/generate` without the header returns 401.
3. Connect YouTube Channel redirects to Google with the right `redirect_uri` and comes back connected.
4. Generate Now creates a brief and the email line shows "Sent".
5. Vercel -> Settings -> Cron Jobs lists `/api/cron/generate`.

## How the numbers work

- **India:** a video counts as India only when its YouTube channel country is exactly `IN`. Videos from other known
  countries are "other countries"; videos whose channel has no country are "country unknown". The search region is never
  used as proof. This is an approximation. India opportunity = 1 - India videos / total videos in the cluster.
- **Ranking:** done in code, never by OpenAI. Weights: momentum 30%, engagement 20%, creator breadth 15%,
  recurrence 15%, India opportunity 15%, views 5%. A measure that is unavailable is dropped and the rest re-scaled.
- **Language:** every YouTube search sends `relevanceLanguage=en` (`SEARCH_LANGUAGE` in `lib/config.js`), so results lean
  English. It is a hint, not a hard filter, so some non-English videos can still appear.
- **Filtering before clustering:** Shorts are removed, then videos with fewer than 1,000 views (`MIN_VIEWS` in
  `lib/config.js`). The 7-day search asks for 30 results per search (`SEARCH_MAX_RESULTS`); a search costs the same 100
  quota units whatever the result count. A cluster needs at least 3 videos on one topic; if fewer than 3 clusters
  qualify, the run stops with a clear message instead of inventing clusters.
- **Public videos have no watch-time data**, so "watch quality" is not available for them and is not in the score.
- **History:** the first run (and the first run after adding a category) does one 90-day search per category and source
  (50 results, Shorts removed), stopping where the current 7-day window starts. Each later successful run also saves its
  own 7-day videos, so history keeps growing. Labels (rules in `lib/config.js`): New (fewer than 2 related past videos),
  Returning (related videos before, none in the last 4 weeks), Recurring (related videos in at least 4 of the last
  12 weeks), otherwise Growing. OpenAI only says which past videos are related; code counts and labels.
- **Your Last 7 Days:** YouTube Analytics data ending 2 days ago. Needs at least 3 videos with views, otherwise it
  shows how many had usable views and the minimum.
- **YouTube quota:** each search costs 100 units (about 10,000 per day). When it runs out the dashboard shows
  "YouTube daily quota used up, it resets at midnight Pacific time" and keeps showing the last successful brief.
