import test from "node:test";
import assert from "node:assert/strict";
import { isReasoningEffortRejected, withReasoningEffort } from "../lib/aiparams.js";

test("reasoning effort is added unless the model is known not to support it", () => {
  assert.equal(withReasoningEffort({ a: 1 }, undefined).reasoning_effort, "low");
  assert.equal(withReasoningEffort({ a: 1 }, true).reasoning_effort, "low");
  assert.equal("reasoning_effort" in withReasoningEffort({ a: 1 }, false), false);
});

test("only a 400 about reasoning_effort counts as 'not supported'", () => {
  assert.equal(isReasoningEffortRejected({ status: 400, message: "Unsupported parameter: 'reasoning_effort'" }), true);
  assert.equal(isReasoningEffortRejected({ status: 400, message: "Invalid model" }), false);
  assert.equal(isReasoningEffortRejected({ status: 500, message: "reasoning_effort" }), false);
  assert.equal(isReasoningEffortRejected(null), false);
});
