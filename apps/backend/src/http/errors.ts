export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function badRequest(message: string, details?: unknown) {
  return new HttpError(400, message, details);
}

export function unauthorized(message = "Требуется авторизация") {
  return new HttpError(401, message);
}

export function forbidden(message = "Недостаточно прав для выполнения действия") {
  return new HttpError(403, message);
}

export function notFound(message = "Запрашиваемый ресурс не найден") {
  return new HttpError(404, message);
}

