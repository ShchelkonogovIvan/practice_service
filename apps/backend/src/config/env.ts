import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  uploadsDir: process.env.UPLOADS_DIR ?? path.resolve(process.cwd(), "uploads"),
  templatesDir: process.env.TEMPLATES_DIR ?? fileURLToPath(new URL("../../templates", import.meta.url))
};
