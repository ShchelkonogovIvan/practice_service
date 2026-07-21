import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../src/http/errors.js";
import { assertApplicationDecision, assertApplicationEditable, validateApplicationAnswers } from "../src/lib/application-policy.js";

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

test("rejection allows an optional administrator comment", () => {
  assert.doesNotThrow(() => assertApplicationDecision("REJECTED"));
  assert.doesNotThrow(() => assertApplicationDecision("REJECTED", undefined, "Не заполнено обязательное поле"));
});

test("removing a participant does not require a role", () => {
  assert.doesNotThrow(() => assertApplicationDecision("REMOVED", undefined, "Исключён администратором"));
});

test("only a pending application can be edited by a student", () => {
  assert.doesNotThrow(() => assertApplicationEditable("PENDING"));
  assertHttpError(() => assertApplicationEditable("APPROVED"), 400);
  assertHttpError(() => assertApplicationEditable("REJECTED"), 400);
  assertHttpError(() => assertApplicationEditable("REMOVED"), 400);
});

function assertHttpError(action: () => unknown, statusCode: number) {
  assert.throws(action, (error) => error instanceof HttpError && error.statusCode === statusCode);
}
