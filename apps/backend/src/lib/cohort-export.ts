import type { ApplicationStatus, ReportReviewStatus } from "@prisma/client";
import { toCsv } from "./csv.js";

type SurveyField = { id: string; label: string };
type ExportApplication = {
  status: ApplicationStatus;
  answers: unknown;
  reviewComment: string | null;
  testTaskAnswer: string | null;
  testTaskArtifactLink: string | null;
  testTaskFileName: string | null;
  testTaskReviewStatus: ReportReviewStatus | null;
  createdAt: Date;
  user: { id: string; email: string };
  role: { name: string } | null;
};
type ExportDocument = {
  userId: string;
  studentFio: string | null;
  group: string | null;
  directionCode: string | null;
  directionName: string | null;
  reportFileName: string | null;
  reportReviewStatus: ReportReviewStatus | null;
};
type ExportTask = { userId: string; doneText: string | null };

export function buildCohortCsv(
  surveyFields: SurveyField[],
  applications: ExportApplication[],
  documents: ExportDocument[],
  tasks: ExportTask[]
) {
  const documentByUser = new Map(documents.map((document) => [document.userId, document]));
  const tasksByUser = new Map<string, ExportTask[]>();
  for (const task of tasks) tasksByUser.set(task.userId, [...(tasksByUser.get(task.userId) ?? []), task]);

  const headers = [
    "Email",
    "Статус заявки",
    "Роль",
    "Дата подачи",
    "Комментарий",
    "Ответ на тестовое задание",
    "Ссылка на результат ТЗ",
    "Файл ответа на ТЗ",
    "Статус проверки ТЗ",
    ...surveyFields.map((field) => field.label),
    "ФИО для документов",
    "Группа",
    "Код направления",
    "Направление",
    "Файл отчёта",
    "Статус отчёта",
    "Задач всего",
    "Задач с результатом"
  ];

  const rows = applications.map((application) => {
    const answers = asAnswers(application.answers);
    const document = documentByUser.get(application.user.id);
    const userTasks = tasksByUser.get(application.user.id) ?? [];
    return [
      application.user.email,
      applicationStatusLabel(application.status),
      application.role?.name ?? "",
      application.createdAt.toISOString(),
      application.reviewComment ?? "",
      application.testTaskAnswer ?? "",
      application.testTaskArtifactLink ?? "",
      application.testTaskFileName ?? "",
      reportStatusLabel(application.testTaskReviewStatus),
      ...surveyFields.map((field) => answerText(answers[field.id])),
      document?.studentFio ?? "",
      document?.group ?? "",
      document?.directionCode ?? "",
      document?.directionName ?? "",
      document?.reportFileName ?? "",
      reportStatusLabel(document?.reportReviewStatus ?? null),
      userTasks.length,
      userTasks.filter((task) => Boolean(task.doneText?.trim())).length
    ];
  });

  return toCsv(headers, rows);
}

function asAnswers(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function answerText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(", ");
  return value === null || value === undefined ? "" : String(value);
}

function applicationStatusLabel(status: ApplicationStatus) {
  return {
    PENDING: "На рассмотрении",
    APPROVED: "Одобрена",
    REJECTED: "Отклонена",
    REMOVED: "Исключён"
  }[status];
}

function reportStatusLabel(status: ReportReviewStatus | null) {
  if (!status) return "Не загружен";
  return {
    PENDING: "На проверке",
    APPROVED: "Одобрен",
    CHANGES_REQUESTED: "Требует исправлений"
  }[status];
}
