// An error whose message is safe and friendly to show to the user.
export class UserError extends Error {}

// Throw a friendly error naming any missing environment variables (never prints values).
export function requireEnv(names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length > 0) {
    throw new UserError(`Missing environment variables: ${missing.join(", ")}. Add them in .env.local or in Vercel.`);
  }
}

// Turn any error into a short message for the dashboard (no stack traces).
export function friendlyMessage(err) {
  if (err instanceof UserError) return err.message;
  return `Something unexpected went wrong: ${String(err && err.message ? err.message : err).slice(0, 200)}`;
}
