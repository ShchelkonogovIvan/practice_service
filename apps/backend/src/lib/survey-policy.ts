import { badRequest } from "../http/errors.js";

type ExistingSurveyField = {
  id: string;
  label: string;
  type: string;
  options: unknown;
  required: boolean;
};

type SurveyFieldChange = {
  id?: string;
  type: string;
  options?: unknown;
  required: boolean;
};

export function assertSurveyFieldChangesAllowed(
  existingFields: ExistingSurveyField[],
  nextFields: SurveyFieldChange[],
  applicationCount: number
) {
  const existingById = new Map(existingFields.map((field) => [field.id, field]));
  const retainedIds = nextFields.flatMap((field) => field.id ? [field.id] : []);

  if (retainedIds.some((id) => !existingById.has(id))) {
    throw badRequest("Одно из полей анкеты не относится к выбранной когорте");
  }
  if (applicationCount === 0) return;

  const retained = new Set(retainedIds);
  if (existingFields.some((field) => !retained.has(field.id))) {
    throw badRequest("Нельзя удалять поля анкеты после появления заявок. Можно изменить подпись или добавить необязательное поле");
  }

  for (const field of nextFields) {
    const existing = field.id ? existingById.get(field.id) : null;
    if (!existing && field.required) {
      throw badRequest("Новое поле можно добавить только как необязательное: в когорте уже есть заявки");
    }
    if (existing && (existing.type !== field.type || json(existing.options) !== json(field.options ?? null))) {
      throw badRequest(`Нельзя менять тип или варианты поля «${existing.label}» после появления заявок`);
    }
    if (existing && !existing.required && field.required) {
      throw badRequest(`Нельзя сделать поле «${existing.label}» обязательным после появления заявок`);
    }
  }
}

function json(value: unknown) {
  return JSON.stringify(value ?? null);
}
