import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../src/http/errors.js";
import { assertSurveyFieldChangesAllowed } from "../src/lib/survey-policy.js";

const existing = [{ id: "fio", label: "ФИО", type: "TEXT", options: null, required: true }];

test("keeps existing questionnaire field ids after applications appear", () => {
  assert.doesNotThrow(() => assertSurveyFieldChangesAllowed(
    existing,
    [{ id: "fio", type: "TEXT", options: undefined, required: true }],
    1
  ));
});

test("allows only optional new fields after applications appear", () => {
  assert.doesNotThrow(() => assertSurveyFieldChangesAllowed(
    existing,
    [
      { id: "fio", type: "TEXT", required: true },
      { type: "TEXTAREA", required: false }
    ],
    1
  ));
  assertHttpError(() => assertSurveyFieldChangesAllowed(
    existing,
    [
      { id: "fio", type: "TEXT", required: true },
      { type: "TEXTAREA", required: true }
    ],
    1
  ));
});

test("prevents deleting or structurally changing answered fields", () => {
  assertHttpError(() => assertSurveyFieldChangesAllowed(existing, [], 1));
  assertHttpError(() => assertSurveyFieldChangesAllowed(
    existing,
    [{ id: "fio", type: "SELECT", options: ["Да", "Нет"], required: true }],
    1
  ));
});

function assertHttpError(action: () => unknown) {
  assert.throws(action, (error) => error instanceof HttpError && error.statusCode === 400);
}
