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
      throw badRequest(`Field "${field.label}" is required`);
    }

    if (isEmptyAnswer(value)) continue;

    if (typeof value !== "string") {
      throw badRequest(`Field "${field.label}" must be a string`);
    }

    if (field.type === "SELECT") {
      const options = Array.isArray(field.options) ? field.options : [];
      const stringOptions = options.filter((option): option is string => typeof option === "string");
      if (stringOptions.length > 0 && !stringOptions.includes(value)) {
        throw badRequest(`Unsupported option for field "${field.label}"`);
      }
    }
  }
}

export function assertApplicationDecision(
  status: "PENDING" | "APPROVED" | "REJECTED",
  roleId?: string,
  reviewComment?: string
) {
  if (status === "APPROVED" && !roleId) {
    throw badRequest("Role is required to approve application");
  }
  if (status === "REJECTED" && !reviewComment) {
    throw badRequest("Review comment is required to reject application");
  }
}

function isEmptyAnswer(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && value.trim().length === 0);
}
