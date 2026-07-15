import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../src/http/errors.js";
import { assertApplicationDecision, validateApplicationAnswers } from "../src/lib/application-policy.js";

const fields = [
  { id: "fio", label: "ФИО", type: "TEXT" as const, options: null, required: true },
  { id: "track", label: "Направление", type: "SELECT" as const, options: ["Backend", "Frontend"], required: true }
];

test("application answers satisfy required fields and select options", () => {
  assert.doesNotThrow(() => validateApplicationAnswers({ fio: "Иван Иванов", track: "Backend" }, fields));
  assertHttpError(() => validateApplicationAnswers({ fio: "", track: "Backend" }, fields), 400);
  assertHttpError(() => validateApplicationAnswers({ fio: "Иван Иванов", track: "Design" }, fields), 400);
});

test("approval requires a cohort role", () => {
  assertHttpError(() => assertApplicationDecision("APPROVED"), 400);
  assert.doesNotThrow(() => assertApplicationDecision("APPROVED", "role-1"));
});

test("rejection requires an administrator comment", () => {
  assertHttpError(() => assertApplicationDecision("REJECTED"), 400);
  assert.doesNotThrow(() => assertApplicationDecision("REJECTED", undefined, "Не заполнено обязательное поле"));
});

function assertHttpError(action: () => unknown, statusCode: number) {
  assert.throws(action, (error) => error instanceof HttpError && error.statusCode === statusCode);
}
