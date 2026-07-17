import { badRequest } from "../http/errors.js";

export function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Некорректный формат данных запроса");
  }
  return value as Record<string, unknown>;
}

export function stringField(body: Record<string, unknown>, name: string, min = 1) {
  const value = body[name];
  if (typeof value !== "string" || value.trim().length < min) {
    throw badRequest(
      min === 1
        ? `Заполните поле «${fieldLabel(name)}»`
        : `Поле «${fieldLabel(name)}» должно содержать не менее ${min} символов`
    );
  }
  return value.trim();
}

export function optionalStringField(body: Record<string, unknown>, name: string) {
  const value = body[name];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw badRequest(`Поле «${fieldLabel(name)}» должно содержать текст`);
  }
  return value.trim();
}

export function dateField(body: Record<string, unknown>, name: string) {
  const value = stringField(body, name);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`Поле «${fieldLabel(name)}» должно содержать корректную дату`);
  }
  return date;
}

export function jsonObjectField(body: Record<string, unknown>, name: string, fallback = {}) {
  const value = body[name] ?? fallback;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(`Поле «${fieldLabel(name)}» имеет некорректный формат`);
  }
  return value;
}

function fieldLabel(name: string) {
  const labels: Record<string, string> = {
    email: "Email",
    password: "Пароль",
    name: "Название",
    applicationStart: "Начало приёма заявок",
    applicationEnd: "Окончание приёма заявок",
    practiceStart: "Начало практики",
    practiceEnd: "Окончание практики",
    answers: "Ответы анкеты",
    content: "Содержание",
    status: "Статус",
    roleId: "Роль",
    reviewComment: "Комментарий",
    date: "Дата",
    title: "Название задачи",
    description: "Описание",
    doneText: "Результат работы",
    artifactLink: "Ссылка на результат",
    label: "Название поля",
    type: "Тип поля"
  };

  return labels[name] ?? name;
}

