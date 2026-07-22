import type { ApplicationStatus, NotificationSection, NotificationType, ReportReviewStatus } from "@prisma/client";

export type NotificationContent = {
  type: NotificationType;
  section: NotificationSection;
  title: string;
  message: string;
};

export function applicationDecisionContent(
  cohortName: string,
  status: ApplicationStatus,
  comment: string | null
): NotificationContent {
  const statusText = status === "APPROVED"
    ? "одобрена"
    : status === "REJECTED"
      ? "отклонена"
      : status === "REMOVED"
        ? "исключена из когорты"
        : "возвращена на рассмотрение";
  return {
    type: "APPLICATION_DECISION",
    section: "APPLICATIONS",
    title: `Статус заявки: ${statusText}`,
    message: [
      `Заявка в когорту «${cohortName}» ${statusText}.`,
      comment ? `Комментарий администратора: ${comment}` : null
    ].filter(Boolean).join(" ")
  };
}

export function applicationSubmittedContent(cohortName: string, studentEmail: string): NotificationContent {
  return {
    type: "APPLICATION_SUBMITTED",
    section: "APPLICATIONS",
    title: "Новая заявка на практику",
    message: `${studentEmail} отправил заявку в когорту «${cohortName}».`
  };
}

export function testTaskContent(cohortName: string, updated: boolean): NotificationContent {
  return {
    type: "TEST_TASK",
    section: "TASKS",
    title: updated ? "Тестовое задание обновлено" : "Тестовое задание опубликовано",
    message: `Для когорты «${cohortName}» ${updated ? "обновлено" : "опубликовано"} тестовое задание.`
  };
}

export function reportReviewContent(
  cohortName: string,
  status: ReportReviewStatus,
  comment: string | null
): NotificationContent {
  const statusText = status === "APPROVED"
    ? "одобрен"
    : status === "CHANGES_REQUESTED"
      ? "требует исправлений"
      : "возвращён на проверку";
  return {
    type: "REPORT_REVIEW",
    section: "DOCUMENTS",
    title: `Проверка отчёта: ${statusText}`,
    message: [
      `Отчёт по когорте «${cohortName}» ${statusText}.`,
      comment ? `Комментарий администратора: ${comment}` : null
    ].filter(Boolean).join(" ")
  };
}

export function reportUploadedContent(cohortName: string, studentEmail: string): NotificationContent {
  return {
    type: "REPORT_UPLOADED",
    section: "DOCUMENTS",
    title: "Загружен отчёт на проверку",
    message: `${studentEmail} загрузил отчёт по когорте «${cohortName}».`
  };
}
