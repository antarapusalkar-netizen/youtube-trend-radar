# YouTube Trend Radar

A weekly content strategy brief for Ishaan, a tech YouTube creator. It reads live YouTube data (global + one region),
asks OpenAI to group videos into 3-5 trend clusters, ranks them in code, saves the brief in Neon, shows it on one
dashboard page and emails it with Resend.

**Status: Layer 1 (core).** Layer 2 (90-day history) and Layer 3 (own channel analytics) come next.

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
- Public videos have no watch-time data, so "Watch quality" shows "Not available" and is not in the score.
- Google OAuth setup and the refresh-token note will be added in Layer 3.
