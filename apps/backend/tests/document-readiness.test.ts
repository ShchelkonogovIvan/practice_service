import assert from "node:assert/strict";
import test from "node:test";
import { documentReadiness } from "../src/lib/document-readiness.js";

const studentFields = {
  studentFio: "Иван Иванов",
  group: "РИ-13003",
  directionCode: "09.03.01",
  directionName: "Информатика и вычислительная техника",
  programName: "Программная инженерия",
  specialty: "Программная инженерия",
  practiceTopic: "Разработка сервиса практики",
  mainStageTasks: "Разработка и тестирование",
  supervisorUrfuName: "Петров П.П."
};

const reviewFields = {
  reviewActivities: "Разработка модуля",
  reviewCharacteristic: "Работа выполнена качественно",
  reviewEmployed: "Нет",
  reviewNextPractice: "Рекомендован",
  reviewEmploymentOffer: "Возможно",
  reviewSuggestions: "Нет",
  reviewGrade: "Отлично"
};

test("individual assignment becomes ready after student fields are filled", () => {
  assert.equal(documentReadiness(null).individualReady, false);
  assert.equal(documentReadiness(studentFields).individualReady, true);
});

test("review requires both student data and administrator review fields", () => {
  assert.equal(documentReadiness(studentFields).reviewReady, false);
  assert.equal(documentReadiness({ ...studentFields, ...reviewFields }).reviewReady, true);
});

test("title page requires a report uploaded and approved by admin", () => {
  assert.equal(documentReadiness(studentFields).titleReady, false);
  assert.equal(documentReadiness({ ...studentFields, reportFileUrl: "reports/report.pdf" }).titleReady, false);
  assert.equal(
    documentReadiness({ ...studentFields, reportFileUrl: "reports/report.pdf", reportReviewStatus: "APPROVED" }).titleReady,
    true
  );
});
