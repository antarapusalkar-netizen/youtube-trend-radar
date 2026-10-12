import test from "node:test";
import assert from "node:assert/strict";
import { youtubeErrorMessage, QUOTA_MESSAGE } from "../lib/ytErrors.js";
import { countUsable, notEnoughDataText } from "../lib/ownstats.js";
import { scoreExplanation } from "../lib/text.js";
import { WEIGHTS } from "../lib/config.js";

test("quota errors map to the exact message", () => {
  assert.equal(QUOTA_MESSAGE, "YouTube daily quota used up, it resets at midnight Pacific time");
  assert.equal(youtubeErrorMessage(403, "quotaExceeded"), QUOTA_MESSAGE);
  assert.equal(youtubeErrorMessage(403, "dailyLimitExceeded"), QUOTA_MESSAGE);
});

test("other YouTube errors stay friendly and never include raw details", () => {
  assert.match(youtubeErrorMessage(400, "keyInvalid"), /YOUTUBE_API_KEY/);
  assert.match(youtubeErrorMessage(500, ""), /status 500/);
});

test("not enough data message shows usable count and the minimum", () => {
  assert.equal(countUsable([{ views: 5 }, { views: 0 }, { views: 9 }]), 2);
  assert.equal(notEnoughDataText(2, 3), "2 videos had usable views. Minimum required: 3.");
  assert.equal(notEnoughDataText(1, 3), "1 video had usable views. Minimum required: 3.");
  assert.equal(notEnoughDataText(0, 3), "0 videos had usable views. Minimum required: 3.");
  assert.equal(notEnoughDataText(undefined, 3), "Not enough data yet. Minimum required: 3.");
});

test("score explanation matches the required wording and the real weights", () => {
  assert.equal(
    scoreExplanation(WEIGHTS),
    "Score = weighted mix of momentum 30%, engagement 20%, creator breadth 15%, recurrence 15%, India opportunity 15%, views 5%"
  );
});
