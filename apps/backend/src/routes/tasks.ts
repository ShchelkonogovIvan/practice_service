import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { badRequest, forbidden, notFound } from "../http/errors.js";
import { prisma } from "../lib/prisma.js";
import { asObject, optionalStringField, stringField } from "../utils/body.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get(
  "/cohorts/:cohortId/tasks",
  asyncHandler(async (req, res) => {
    const showAll = req.query.showAll === "true" || req.user!.role === UserRole.ADMIN;
    const where = {
      cohortId: req.params.cohortId,
      ...(showAll ? {} : { userId: req.user!.id })
    };

    const cards = await prisma.taskCard.findMany({
      where,
      include: {
        user: { select: { id: true, email: true } }
      },
      orderBy: [{ date: "asc" }, { updatedAt: "desc" }]
    });

    res.json({ cards });
  })
);

tasksRouter.post(
  "/cohorts/:cohortId/tasks",
  asyncHandler(async (req, res) => {
    const body = asObject(req.body);
    const date = new Date(stringField(body, "date"));
    if (Number.isNaN(date.getTime())) {
      throw badRequest("Task date must be valid");
    }

    const card = await prisma.taskCard.create({
      data: {
        userId: req.user!.id,
        cohortId: req.params.cohortId,
        date,
        title: stringField(body, "title"),
        description: optionalStringField(body, "description"),
        doneText: optionalStringField(body, "doneText"),
        artifactLink: optionalStringField(body, "artifactLink")
      }
    });

    res.status(201).json({ card });
  })
);

tasksRouter.patch(
  "/tasks/:taskId",
  asyncHandler(async (req, res) => {
    const body = asObject(req.body);
    const card = await prisma.taskCard.findUnique({ where: { id: req.params.taskId } });
    if (!card) {
      throw notFound("Task card not found");
    }
    if (req.user!.role !== UserRole.ADMIN && card.userId !== req.user!.id) {
      throw forbidden("You can edit only your own task cards");
    }

    const updated = await prisma.taskCard.update({
      where: { id: card.id },
      data: {
        title: optionalStringField(body, "title") ?? undefined,
        description: optionalStringField(body, "description") ?? undefined,
        doneText: optionalStringField(body, "doneText") ?? undefined,
        artifactLink: optionalStringField(body, "artifactLink") ?? undefined
      }
    });

    res.json({ card: updated });
  })
);

