import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { HttpError } from "../http/errors.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: `Маршрут ${req.method} ${req.path} не найден` });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({ message: error.message, details: error.details });
  }

  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Размер файла не должен превышать 10 МБ"
      : "Не удалось загрузить файл";
    return res.status(400).json({ message, details: error.code });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return res.status(409).json({ message: "Такая запись уже существует", details: error.meta });
  }

  console.error(error);
  return res.status(500).json({ message: "Внутренняя ошибка сервера. Попробуйте ещё раз позже" });
}

