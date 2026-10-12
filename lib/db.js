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
