import { badRequest, forbidden } from "../http/errors.js";

type TaskActorRole = "ADMIN" | "STUDENT";

export function parseTaskDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest("Дата задачи должна быть указана в формате ГГГГ-ММ-ДД");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatDateKey(date) !== value) {
    throw badRequest("Укажите корректную дату задачи");
  }
  return date;
}

export function assertTaskDateAllowed(date: Date, practiceStart: Date, practiceEnd: Date) {
  const dateKey = formatDateKey(date);
  if (dateKey < formatDateKey(practiceStart) || dateKey > formatDateKey(practiceEnd)) {
    throw badRequest("Дата задачи должна входить в период практики");
  }

  const dayOfWeek = date.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw badRequest("Задачу можно добавить только на рабочий день");
  }
}

export function assertCanEditTaskCard(role: TaskActorRole, actorUserId: string, ownerUserId: string) {
  if (role !== "ADMIN" && actorUserId !== ownerUserId) {
    throw forbidden("Можно редактировать только собственные задачи");
  }
}

function formatDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
