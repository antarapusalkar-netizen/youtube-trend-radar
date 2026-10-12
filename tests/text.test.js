import test from "node:test";
import assert from "node:assert/strict";
import { replaceIds } from "../lib/text.js";

test("replaceIds swaps ids for short titles", () => {
  const out = replaceIds("abc-1 has 10 views. abc-1 and zz_2 grew.", { "abc-1": "Short title", zz_2: "A very long title that keeps going and going on" }, 20);
  assert.equal(out, "“Short title” has 10 views. “Short title” and “A very long title th…” grew.");
});

test("replaceIds leaves text alone when there are no ids", () => {
  assert.equal(replaceIds("No ids here.", {}), "No ids here.");
});
