import { badRequest, forbidden } from "../http/errors.js";

type TaskActorRole = "ADMIN" | "STUDENT";

export function parseTaskDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest("Task date must be in YYYY-MM-DD format");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatDateKey(date) !== value) {
    throw badRequest("Task date must be valid");
  }
  return date;
}

export function assertTaskDateAllowed(date: Date, practiceStart: Date, practiceEnd: Date) {
  const dateKey = formatDateKey(date);
  if (dateKey < formatDateKey(practiceStart) || dateKey > formatDateKey(practiceEnd)) {
    throw badRequest("Task date must be within the cohort practice period");
  }

  const dayOfWeek = date.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw badRequest("Task date must be a working day");
  }
}

export function assertCanEditTaskCard(role: TaskActorRole, actorUserId: string, ownerUserId: string) {
  if (role !== "ADMIN" && actorUserId !== ownerUserId) {
    throw forbidden("You can edit only your own task cards");
  }
}

function formatDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
