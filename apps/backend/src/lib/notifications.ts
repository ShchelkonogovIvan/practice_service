import type { ApplicationStatus, ReportReviewStatus } from "@prisma/client";
import { env } from "../config/env.js";
import { sendEmail } from "./mailer.js";

export async function notifyApplicationDecision(
  email: string,
  cohortName: string,
  status: ApplicationStatus,
  comment: string | null
) {
  const statusText = status === "APPROVED" ? "одобрена" : status === "REJECTED" ? "отклонена" : "возвращена на рассмотрение";
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

export async function notifyTestTaskPublished(emails: string[], cohortName: string) {
  const uniqueEmails = [...new Set(emails)];
  const results = await Promise.all(uniqueEmails.map((email) => sendEmail({
    to: email,
    subject: `Опубликовано тестовое задание: ${cohortName}`,
    text: `Для когорты «${cohortName}» опубликовано тестовое задание.\n\nОткрыть личный кабинет: ${env.appUrl}/dashboard`
  })));

  return {
    recipients: uniqueEmails.length,
    sent: results.filter((result) => result.sent).length
  };
}

export async function notifyReportReview(
  email: string,
  cohortName: string,
  status: ReportReviewStatus,
  comment: string | null
) {
  const statusText = status === "APPROVED" ? "одобрен" : status === "CHANGES_REQUESTED" ? "требует исправлений" : "направлен на повторную проверку";
  return sendEmail({
    to: email,
    subject: `Проверка отчёта: ${statusText}`,
    text: [
      `Ваш отчёт по когорте «${cohortName}» ${statusText}.`,
      comment ? `Комментарий администратора: ${comment}` : null,
      `Открыть документы: ${env.appUrl}/dashboard`
    ].filter(Boolean).join("\n\n")
  });
}
