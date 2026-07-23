import { badRequest } from "../http/errors.js";

type PracticePeriod = {
  practiceEnd: Date;
  completedAt: Date | null;
};

export function isPracticeClosed(period: PracticePeriod, now = new Date()) {
  const closesAt = Date.UTC(
    period.practiceEnd.getUTCFullYear(),
    period.practiceEnd.getUTCMonth(),
    period.practiceEnd.getUTCDate() + 1
  );
  return Boolean(period.completedAt) || now.getTime() >= closesAt;
}

export function assertPracticeOpen(period: PracticePeriod, now = new Date()) {
  if (isPracticeClosed(period, now)) {
    throw badRequest("Практика завершена, изменение данных недоступно");
  }
}
