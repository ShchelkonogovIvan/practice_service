import type { ApplicationStatus, ReportReviewStatus } from "@prisma/client";
import { env } from "../config/env.js";
import { sendEmail } from "./mailer.js";

export async function notifyApplicationDecision(
  email: string,
  cohortName: string,
  status: ApplicationStatus,
  comment: string | null
) {
  const statusText = status === "APPROVED"
    ? "одобрена"
    : status === "REJECTED"
      ? "отклонена"
      : status === "REMOVED"
        ? "исключена из когорты"
        : "возвращена на рассмотрение";
  return sendEmail({
    to: email,
    subject: `Статус заявки на практику: ${statusText}`,
    text: [
      `Ваша заявка в когорту «${cohortName}» ${statusText}.`,
      comment ? `Комментарий администратора: ${comment}` : null,
      `Открыть личный кабинет: ${env.appUrl}/dashboard`
    ].filter(Boolean).join("\n\n")
  });
}

export async function notifyTestTaskPublished(
  emails: string[],
  cohortName: string,
  content: string,
  updated = false
) {
  const uniqueEmails = [...new Set(emails)];
  const results = await Promise.all(uniqueEmails.map((email) => sendEmail({
    to: email,
    subject: `${updated ? "Обновлено" : "Опубликовано"} тестовое задание: ${cohortName}`,
    text: [
      `Для когорты «${cohortName}» ${updated ? "обновлено" : "опубликовано"} тестовое задание.`,
      "Тестовое задание:",
      content,
      `Открыть личный кабинет: ${env.appUrl}/dashboard`
    ].join("\n\n")
  })));

  return {
    recipients: uniqueEmails.length,
    sent: results.filter((result) => result.sent).length,
    configured: results.every((result) => result.sent || result.reason !== "SMTP is not configured")
  };
}

export async function notifyReportReview(
  email: string,
  cohortName: string,
  status: ReportReviewStatus,
  comment: string | null
) {
  const statusText = status === "APPROVED" ? "одобрен" : status === "CHANGES_REQUESTED" ? "требует исправлений" : "допуск снят";
  const resultText = status === "PENDING"
    ? `Допуск к скачиванию титульного листа по когорте «${cohortName}» снят.`
    : `Ваш отчёт по когорте «${cohortName}» ${statusText}.`;
  return sendEmail({
    to: email,
    subject: `Проверка отчёта: ${statusText}`,
    text: [
      resultText,
      comment ? `Комментарий администратора: ${comment}` : null,
      `Открыть документы: ${env.appUrl}/dashboard`
    ].filter(Boolean).join("\n\n")
  });
}
