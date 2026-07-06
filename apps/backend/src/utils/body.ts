import { badRequest } from "../http/errors.js";

export function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Request body must be an object");
  }
  return value as Record<string, unknown>;
}

export function stringField(body: Record<string, unknown>, name: string, min = 1) {
  const value = body[name];
  if (typeof value !== "string" || value.trim().length < min) {
    throw badRequest(`Field "${name}" must be a string with at least ${min} characters`);
  }
  return value.trim();
}

export function optionalStringField(body: Record<string, unknown>, name: string) {
  const value = body[name];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw badRequest(`Field "${name}" must be a string`);
  }
  return value.trim();
}

export function dateField(body: Record<string, unknown>, name: string) {
  const value = stringField(body, name);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`Field "${name}" must be a valid date`);
  }
  return date;
}

export function jsonObjectField(body: Record<string, unknown>, name: string, fallback = {}) {
  const value = body[name] ?? fallback;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(`Field "${name}" must be an object`);
  }
  return value;
}

