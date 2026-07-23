import assert from "node:assert/strict";
import test from "node:test";
import type { AdminApplication, AdminDocumentRow, StudentDocumentData, TaskBoard } from "../src/lib/api";
import {
  buildAdminOverview,
  filterAdminApplications,
  filterAdminDocumentRows,
  studentDocumentFieldsReadiness
} from "../src/lib/admin-dashboard.ts";

test("document indicators depend only on fields filled by the student", () => {
  const complete = documentData({
    studentFio: "Иванов Иван",
    studentFioGenitive: "Иванова Ивана",
    group: "РИ-13003",
    directionCode: "09.03.03",
    directionName: "Прикладная информатика",
    programName: "Разработка ПО",
    specialty: "Программист",
    practiceTopic: "Сервис практики",
    mainStageTasks: "Разработка и тестирование",
    supervisorUrfuName: "Корнякова Елена Михайловна",
    reviewCharacteristic: null,
    reportReviewStatus: null
  });

  assert.deepEqual(studentDocumentFieldsReadiness(complete), {
    individual: true,
    review: true,
    title: true
  });

  assert.deepEqual(studentDocumentFieldsReadiness({ ...complete, group: "  " }), {
    individual: false,
    review: false,
    title: false
  });
  assert.deepEqual(studentDocumentFieldsReadiness(null), {
    individual: false,
    review: false,
    title: false
  });
});

test("application filtering combines status and case-insensitive search", () => {
  const applications = [
    application("pending", "PENDING", "student@example.com", { fio: "Иванов Иван", profile: { group: "РИ-13003" } }, "Backend"),
    application("approved", "APPROVED", "second@example.com", { fio: "Петров Пётр" }, "Frontend")
  ];

  assert.deepEqual(filterAdminApplications(applications, "PENDING", " иВАНОВ ").map(({ id }) => id), ["pending"]);
  assert.deepEqual(filterAdminApplications(applications, "ALL", "ри-13003").map(({ id }) => id), ["pending"]);
  assert.deepEqual(filterAdminApplications(applications, "APPROVED", "backend"), []);
});

test("document filtering distinguishes report states and searches participant data", () => {
  const rows = [
    documentRow("missing", false, null, "Без Отчёта", "РИ-1", "student1@example.com", "Backend"),
    documentRow("pending", true, null, "На Проверке", "РИ-2", "student2@example.com", "Frontend"),
    documentRow("approved", true, "APPROVED", "Одобрен", "РИ-3", "student3@example.com", "Analytics"),
    documentRow("revision", true, "CHANGES_REQUESTED", "На Доработке", "РИ-4", "student4@example.com", "QA")
  ];

  assert.deepEqual(filterAdminDocumentRows(rows, "NOT_UPLOADED", "").map(({ applicationId }) => applicationId), ["missing"]);
  assert.deepEqual(filterAdminDocumentRows(rows, "PENDING", "").map(({ applicationId }) => applicationId), ["pending"]);
  assert.deepEqual(filterAdminDocumentRows(rows, "APPROVED", "ри-3").map(({ applicationId }) => applicationId), ["approved"]);
  assert.deepEqual(filterAdminDocumentRows(rows, "CHANGES_REQUESTED", "qa").map(({ applicationId }) => applicationId), ["revision"]);
});

test("admin overview combines applications, document progress, reports and tasks", () => {
  const applications = [
    application("pending", "PENDING", "pending@example.com", {}, "Backend"),
    application("approved", "APPROVED", "approved@example.com", {}, "Frontend"),
    application("rejected", "REJECTED", "rejected@example.com", {}, "QA")
  ];
  const documents = [
    documentRow("approved-report", true, "APPROVED", "Иванов Иван", "РИ-1", "one@example.com", "Backend"),
    documentRow("pending-report", true, null, "Петров Пётр", "РИ-2", "two@example.com", "Frontend"),
    documentRow("revision-report", true, "CHANGES_REQUESTED", "Сидоров Сидор", "РИ-3", "three@example.com", "QA"),
    documentRow("no-report", false, null, "Смирнов Алексей", "РИ-4", "four@example.com", "Analytics")
  ];
  documents[0].data = completeStudentData({ reportReviewStatus: "APPROVED" });

  const result = buildAdminOverview(applications, documents, taskBoard(["Готово", "  ", null]));

  assert.deepEqual(result, {
    totalApplications: 3,
    pendingApplications: 1,
    approvedApplications: 1,
    rejectedApplications: 1,
    participants: 4,
    completeDocumentProfiles: 1,
    reportsUploaded: 3,
    reportsToReview: 1,
    reportsForRevision: 1,
    reportsApproved: 1,
    totalTasks: 3,
    completedTasks: 1,
    incompleteTasks: 2
  });
});

function application(
  id: string,
  status: AdminApplication["status"],
  email: string,
  answers: Record<string, unknown>,
  roleName: string
): AdminApplication {
  return {
    id,
    status,
    answers,
    reviewComment: null,
    testTaskAnswer: null,
    testTaskArtifactLink: null,
    testTaskFileUrl: null,
    testTaskFileName: null,
    testTaskSubmittedAt: null,
    testTaskReviewStatus: null,
    testTaskReviewComment: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    role: { id: `${id}-role`, name: roleName },
    user: { id: `${id}-user`, email }
  };
}

function documentRow(
  applicationId: string,
  reportUploaded: boolean,
  reportReviewStatus: StudentDocumentData["reportReviewStatus"],
  studentFio: string,
  group: string,
  email: string,
  roleName: string
): AdminDocumentRow {
  return {
    applicationId,
    user: { id: `${applicationId}-user`, email },
    role: { id: `${applicationId}-role`, name: roleName },
    data: documentData({ studentFio, group, reportReviewStatus }),
    readiness: {
      individualReady: false,
      reviewReady: false,
      titleReady: false,
      reportUploaded,
      reportApproved: reportReviewStatus === "APPROVED",
      individualReason: null,
      reviewReason: null,
      titleReason: null
    }
  };
}

function documentData(overrides: Partial<StudentDocumentData>): StudentDocumentData {
  return {
    id: "document-id",
    userId: "user-id",
    cohortId: "cohort-id",
    studentFio: null,
    studentFioGenitive: null,
    group: null,
    directionCode: null,
    directionName: null,
    programName: null,
    specialty: null,
    practiceTopic: null,
    mainStageTasks: null,
    supervisorUrfuName: null,
    reviewActivities: null,
    reviewCharacteristic: null,
    reviewEmployed: null,
    reviewNextPractice: null,
    reviewEmploymentOffer: null,
    reviewSuggestions: null,
    reviewGrade: null,
    reportFileUrl: null,
    reportFileName: null,
    reportUploadedAt: null,
    reportReviewStatus: null,
    reportReviewComment: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides
  };
}

function completeStudentData(overrides: Partial<StudentDocumentData> = {}) {
  return documentData({
    studentFio: "Иванов Иван",
    studentFioGenitive: "Иванова Ивана",
    group: "РИ-13003",
    directionCode: "09.03.03",
    directionName: "Прикладная информатика",
    programName: "Разработка ПО",
    specialty: "Программист",
    practiceTopic: "Сервис практики",
    mainStageTasks: "Разработка и тестирование",
    supervisorUrfuName: "Корнякова Елена Михайловна",
    ...overrides
  });
}

function taskBoard(doneValues: Array<string | null>): TaskBoard {
  return {
    cohort: {
      id: "cohort-id",
      name: "Летняя практика",
      practiceStart: "2026-07-01T00:00:00.000Z",
      practiceEnd: "2026-07-31T00:00:00.000Z",
      completedAt: null,
      closed: false
    },
    participants: [{
      userId: "user-id",
      displayName: "Иванов Иван",
      role: null,
      cards: doneValues.map((doneText, index) => ({
        id: `task-${index}`,
        userId: "user-id",
        cohortId: "cohort-id",
        date: `2026-07-${String(index + 1).padStart(2, "0")}`,
        title: `Задача ${index + 1}`,
        description: null,
        doneText,
        artifactLink: null,
        createdAt: "2026-07-20T00:00:00.000Z",
        updatedAt: "2026-07-20T00:00:00.000Z"
      }))
    }]
  };
}
