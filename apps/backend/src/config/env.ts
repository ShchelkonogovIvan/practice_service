import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Не задана обязательная переменная окружения ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const localMail = nodeEnv !== "production";
const jwtSecret = required("JWT_SECRET");

if (nodeEnv === "production" && (jwtSecret.length < 32 || jwtSecret === "change-me-in-production")) {
  throw new Error("В production переменная JWT_SECRET должна содержать не менее 32 символов");
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  appUrl: process.env.APP_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:3000",
  uploadsDir: process.env.UPLOADS_DIR ?? path.resolve(process.cwd(), "uploads"),
  templatesDir: process.env.TEMPLATES_DIR ?? fileURLToPath(new URL("../../templates", import.meta.url)),
  smtp: {
    host: process.env.SMTP_HOST || (localMail ? "127.0.0.1" : undefined),
    port: Number(process.env.SMTP_PORT || (localMail ? 1025 : 587)),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.MAIL_FROM || (localMail ? "Практика <practice@localhost>" : undefined)
  }
};
