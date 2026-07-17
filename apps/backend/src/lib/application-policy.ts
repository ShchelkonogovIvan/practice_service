import { badRequest } from "../http/errors.js";

type SurveyField = {
  id: string;
  label: string;
  type: "TEXT" | "TEXTAREA" | "SELECT";
  options: unknown;
  required: boolean;
};

export function validateApplicationAnswers(answers: Record<string, unknown>, surveyFields: SurveyField[]) {
  for (const field of surveyFields) {
    const value = answers[field.id];

    if (field.required && isEmptyAnswer(value)) {
      throw badRequest(`Заполните обязательное поле «${field.label}»`);
    }

    if (isEmptyAnswer(value)) continue;

    if (typeof value !== "string") {
      throw badRequest(`Поле «${field.label}» должно содержать текст`);
    }

    if (field.type === "SELECT") {
      const options = Array.isArray(field.options) ? field.options : [];
      const stringOptions = options.filter((option): option is string => typeof option === "string");
      if (stringOptions.length > 0 && !stringOptions.includes(value)) {
        throw badRequest(`Выбрано недопустимое значение поля «${field.label}»`);
      }
    }
  }
}

export function assertApplicationDecision(
  status: "PENDING" | "APPROVED" | "REJECTED",
  roleId?: string,
  _reviewComment?: string
) {
  if (status === "APPROVED" && !roleId) {
    throw badRequest("Для одобрения заявки необходимо выбрать роль");
  }
}

function isEmptyAnswer(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && value.trim().length === 0);
}
