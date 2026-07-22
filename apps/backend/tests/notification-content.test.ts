import assert from "node:assert/strict";
import test from "node:test";
import {
  applicationDecisionContent,
  applicationSubmittedContent,
  reportReviewContent,
  reportUploadedContent,
  testTaskContent
} from "../src/lib/notification-content.js";

test("application notification contains status, cohort and administrator comment", () => {
  const content = applicationDecisionContent("Лето 2026", "REJECTED", "Дополните анкету");
  assert.equal(content.type, "APPLICATION_DECISION");
  assert.equal(content.section, "APPLICATIONS");
  assert.match(content.title, /отклонена/);
  assert.match(content.message, /Лето 2026/);
  assert.match(content.message, /Дополните анкету/);
});

test("test task notification distinguishes publication and update", () => {
  assert.match(testTaskContent("Backend", false).title, /опубликовано/);
  assert.match(testTaskContent("Backend", true).title, /обновлено/);
  assert.equal(testTaskContent("Backend", false).section, "TASKS");
});

test("report review notification points to documents", () => {
  const content = reportReviewContent("Лето 2026", "CHANGES_REQUESTED", "Исправьте титульный лист");
  assert.equal(content.type, "REPORT_REVIEW");
  assert.equal(content.section, "DOCUMENTS");
  assert.match(content.message, /Исправьте титульный лист/);
});

test("administrator notifications identify the student and target section", () => {
  const application = applicationSubmittedContent("Лето 2026", "student@example.com");
  const report = reportUploadedContent("Лето 2026", "student@example.com");
  assert.equal(application.section, "APPLICATIONS");
  assert.equal(report.section, "DOCUMENTS");
  assert.match(application.message, /student@example.com/);
  assert.match(report.message, /student@example.com/);
});
