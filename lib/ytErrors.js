// Turns a YouTube API error (HTTP status + reason) into a friendly message. Pure, so it can be tested.
export const QUOTA_MESSAGE = "YouTube daily quota used up, it resets at midnight Pacific time";

export function youtubeErrorMessage(status, reason) {
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") return QUOTA_MESSAGE;
  if (reason === "keyInvalid" || reason === "badRequest" || status === 400 || status === 403) {
    return "YouTube rejected the request. Check that YOUTUBE_API_KEY is valid and the YouTube Data API v3 is enabled.";
  }
  return `YouTube returned an error (status ${status}).`;
}
