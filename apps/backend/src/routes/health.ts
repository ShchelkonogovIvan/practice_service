import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "ok" });
  })
);

