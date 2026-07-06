import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { adminApplicationsRouter, applicationsRouter } from "./routes/applications.js";
import { authRouter } from "./routes/auth.js";
import { cohortsRouter, publicCohortsRouter } from "./routes/cohorts.js";
import { adminDocumentsRouter, documentsRouter } from "./routes/documents.js";
import { healthRouter } from "./routes/health.js";
import { tasksRouter } from "./routes/tasks.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/public/cohorts", publicCohortsRouter);
  app.use("/api/cohorts", cohortsRouter);
  app.use("/api", applicationsRouter);
  app.use("/api/admin", adminApplicationsRouter);
  app.use("/api", documentsRouter);
  app.use("/api/admin", adminDocumentsRouter);
  app.use("/api", tasksRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

