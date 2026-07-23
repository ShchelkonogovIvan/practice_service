import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../src/http/errors.js";
import { assertPracticeOpen, isPracticeClosed } from "../src/lib/practice-period.js";

const end = new Date("2026-08-23T00:00:00.000Z");

test("practice remains open through its end date", () => {
  const period = { practiceEnd: end, completedAt: null };
  assert.equal(isPracticeClosed(period, new Date("2026-08-23T12:00:00.000Z")), false);
  assert.doesNotThrow(() => assertPracticeOpen(period, new Date("2026-08-23T12:00:00.000Z")));
});

test("practice closes after its end date or manual completion", () => {
  assert.equal(isPracticeClosed({ practiceEnd: end, completedAt: null }, new Date("2026-08-24T00:00:00.000Z")), true);
  assert.equal(isPracticeClosed({ practiceEnd: end, completedAt: new Date("2026-08-10T00:00:00.000Z") }, new Date("2026-08-11T00:00:00.000Z")), true);
  assert.throws(
    () => assertPracticeOpen({ practiceEnd: end, completedAt: null }, new Date("2026-08-24T00:00:00.000Z")),
    (error) => error instanceof HttpError && error.statusCode === 400
  );
});
