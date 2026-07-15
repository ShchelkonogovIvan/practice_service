import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../src/http/errors.js";
import { assertCanEditTaskCard, assertTaskDateAllowed, parseTaskDate } from "../src/lib/task-policy.js";

test("task date parser accepts a real ISO date", () => {
  assert.equal(parseTaskDate("2026-07-15").toISOString(), "2026-07-15T00:00:00.000Z");
});

test("task date parser rejects invalid and non-ISO dates", () => {
  assertHttpError(() => parseTaskDate("15.07.2026"), 400);
  assertHttpError(() => parseTaskDate("2026-02-30"), 400);
});

test("task date must be a weekday inside the practice period", () => {
  const start = new Date("2026-07-13T00:00:00.000Z");
  const end = new Date("2026-07-24T00:00:00.000Z");

  assert.doesNotThrow(() => assertTaskDateAllowed(parseTaskDate("2026-07-15"), start, end));
  assertHttpError(() => assertTaskDateAllowed(parseTaskDate("2026-07-12"), start, end), 400);
  assertHttpError(() => assertTaskDateAllowed(parseTaskDate("2026-07-18"), start, end), 400);
});

test("students edit only their own cards while admins may edit any card", () => {
  assert.doesNotThrow(() => assertCanEditTaskCard("STUDENT", "student-1", "student-1"));
  assertHttpError(() => assertCanEditTaskCard("STUDENT", "student-1", "student-2"), 403);
  assert.doesNotThrow(() => assertCanEditTaskCard("ADMIN", "admin-1", "student-2"));
});

function assertHttpError(action: () => unknown, statusCode: number) {
  assert.throws(action, (error) => error instanceof HttpError && error.statusCode === statusCode);
}
