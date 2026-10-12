// Neon database: creates its own tables, saves settings and briefs.
import { neon } from "@neondatabase/serverless";
import { requireEnv } from "./errors.js";
import { DEFAULT_CATEGORIES, DEFAULT_REGION } from "./config.js";

let sqlClient = null;
let tablesReady = null;

// Returns the sql function after making sure the tables exist.
async function db() {
  requireEnv(["DATABASE_URL"]);
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  if (!tablesReady) {
    tablesReady = (async () => {
      await sqlClient`CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY, region TEXT NOT NULL, categories JSONB NOT NULL)`;
      await sqlClient`CREATE TABLE IF NOT EXISTS briefs (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL,
        trigger TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        window_days INT,
        region TEXT,
        categories JSONB,
        clusters JSONB,
        own_channel JSONB,
        email_status TEXT,
        email_error TEXT)`;
      await sqlClient`CREATE TABLE IF NOT EXISTS channel_connection (
        id INT PRIMARY KEY, channel_id TEXT NOT NULL, channel_title TEXT,
        refresh_token TEXT NOT NULL, connected_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
      await sqlClient`CREATE TABLE IF NOT EXISTS history_videos (
        video_id TEXT NOT NULL, category TEXT NOT NULL, source TEXT NOT NULL,
        title TEXT, channel_id TEXT, channel_name TEXT, channel_country TEXT,
        published_at TIMESTAMPTZ NOT NULL,
        views BIGINT, likes BIGINT, comments BIGINT, duration_seconds INT,
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (video_id, category, source))`;
    })().catch((err) => {
      tablesReady = null;
      throw err;
    });
  }
  await tablesReady;
  return sqlClient;
}

// ---- Settings (one row) ----
export async function getSettings() {
  const sql = await db();
  const rows = await sql`SELECT region, categories FROM settings WHERE id = 1`;
  if (rows.length === 0) return { region: DEFAULT_REGION, categories: DEFAULT_CATEGORIES };
  return rows[0];
}

export async function saveSettings(region, categories) {
  const sql = await db();
  await sql`INSERT INTO settings (id, region, categories) VALUES (1, ${region}, ${JSON.stringify(categories)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET region = EXCLUDED.region, categories = EXCLUDED.categories`;
}

// ---- Briefs ----
export async function saveBrief(b) {
  const sql = await db();
  const rows = await sql`INSERT INTO briefs
    (created_at, trigger, status, error, window_days, region, categories, clusters, own_channel, email_status, email_error)
    VALUES (${b.createdAt}, ${b.trigger}, ${b.status}, ${b.error || null}, ${b.windowDays}, ${b.region},
      ${JSON.stringify(b.categories)}::jsonb, ${JSON.stringify(b.clusters || null)}::jsonb,
      ${JSON.stringify(b.ownChannel || null)}::jsonb, ${b.emailStatus || null}, ${b.emailError || null})
    RETURNING id`;
  return rows[0].id;
}

export async function updateEmailStatus(id, status, error) {
  const sql = await db();
  await sql`UPDATE briefs SET email_status = ${status}, email_error = ${error || null} WHERE id = ${id}`;
}

// True if any run (ok or failed) started in the last `minutes` minutes.
export async function ranRecently(minutes) {
  const sql = await db();
  const rows = await sql`SELECT 1 FROM briefs WHERE created_at > now() - (${minutes} * interval '1 minute') LIMIT 1`;
  return rows.length > 0;
}

export async function getBrief(id) {
  const sql = await db();
  const rows = await sql`SELECT * FROM briefs WHERE id = ${id}`;
  return rows[0] || null;
}

export async function getLatestBrief(onlyOk) {
  const sql = await db();
  const rows = onlyOk
    ? await sql`SELECT * FROM briefs WHERE status = 'ok' ORDER BY created_at DESC LIMIT 1`
    : await sql`SELECT * FROM briefs ORDER BY created_at DESC LIMIT 1`;
  return rows[0] || null;
}

export async function listBriefs() {
  const sql = await db();
  return sql`SELECT id, created_at, trigger, status FROM briefs ORDER BY created_at DESC LIMIT 20`;
}

// ---- 90-day history ----

// Categories that already have saved history (so they are not backfilled again).
export async function categoriesWithHistory() {
  const sql = await db();
  const rows = await sql`SELECT DISTINCT category FROM history_videos`;
  return rows.map((r) => r.category);
}

// Saves videos in one query. Videos already saved are left as they are.
export async function saveHistoryVideos(videos) {
  if (videos.length === 0) return;
  const sql = await db();
  const rows = videos.map((v) => ({
    video_id: v.id, category: v.category, source: v.source, title: v.title,
    channel_id: v.channelId, channel_name: v.channelName, channel_country: v.channelCountry,
    published_at: v.publishedAt, views: v.views, likes: v.likes, comments: v.comments,
    duration_seconds: v.durationSeconds,
  }));
  await sql`INSERT INTO history_videos
      (video_id, category, source, title, channel_id, channel_name, channel_country, published_at, views, likes, comments, duration_seconds)
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(
      video_id TEXT, category TEXT, source TEXT, title TEXT, channel_id TEXT, channel_name TEXT,
      channel_country TEXT, published_at TIMESTAMPTZ, views BIGINT, likes BIGINT, comments BIGINT, duration_seconds INT)
    ON CONFLICT DO NOTHING`;
}

// Saved videos for these categories published between `after` and `before`, one row per video, most viewed first.
export async function getHistoryVideos(categories, after, before) {
  const sql = await db();
  const rows = await sql`SELECT DISTINCT ON (video_id) video_id, title, published_at, views
    FROM history_videos
    WHERE category = ANY(${categories}) AND published_at >= ${after} AND published_at < ${before}
    ORDER BY video_id, views DESC`;
  return rows
    .map((r) => ({ id: r.video_id, title: r.title, publishedAt: r.published_at, views: Number(r.views) }))
    .sort((a, b) => b.views - a.views);
}

// ---- Connected YouTube channel (only one; connecting again replaces it) ----
export async function saveConnection(channelId, channelTitle, refreshToken) {
  const sql = await db();
  await sql`INSERT INTO channel_connection (id, channel_id, channel_title, refresh_token, connected_at)
    VALUES (1, ${channelId}, ${channelTitle}, ${refreshToken}, now())
    ON CONFLICT (id) DO UPDATE SET channel_id = EXCLUDED.channel_id, channel_title = EXCLUDED.channel_title,
      refresh_token = EXCLUDED.refresh_token, connected_at = now()`;
}

// Includes the refresh token: only use this on the server, never send it to the browser.
export async function getConnection() {
  const sql = await db();
  const rows = await sql`SELECT channel_id, channel_title, refresh_token, connected_at FROM channel_connection WHERE id = 1`;
  return rows[0] || null;
}

// Safe version for the dashboard (no token).
export async function getConnectionInfo() {
  const sql = await db();
  const rows = await sql`SELECT channel_title, connected_at FROM channel_connection WHERE id = 1`;
  return rows[0] || null;
}
