import { Router } from "express";
import { ApplicationStatus, UserRole } from "@prisma/client";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { badRequest, forbidden, notFound } from "../http/errors.js";
import { requireApprovedApplication } from "../lib/cohort-access.js";
import { prisma } from "../lib/prisma.js";
import { assertCanEditTaskCard, assertTaskDateAllowed, parseTaskDate } from "../lib/task-policy.js";
import { asObject, optionalStringField, stringField } from "../utils/body.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get(
  "/cohorts/:cohortId/tasks",
  asyncHandler(async (req, res) => {
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.cohortId },
      select: {
        id: true,
        name: true,
        practiceStart: true,
        practiceEnd: true,
        completedAt: true,
        surveyFields: { select: { id: true, label: true } }
      }
    });
    if (!cohort) {
      throw notFound("Когорта не найдена");
    }

    if (req.user!.role !== UserRole.ADMIN) {
      await requireApprovedApplication(req.user!.id, req.params.cohortId);
    }

    const showAll = req.query.showAll === "true" || req.user!.role === UserRole.ADMIN;
    const applications = await prisma.application.findMany({
      where: {
        cohortId: cohort.id,
        status: ApplicationStatus.APPROVED,
        ...(showAll ? {} : { userId: req.user!.id })
      },
      select: {
        userId: true,
        answers: true,
        role: { select: { id: true, name: true } },
        user: {
          select: {
            email: true,
            documents: {
              where: { cohortId: cohort.id },
              select: { studentFio: true },
              take: 1
            }
          }
        }
      }
    });

    const participantIds = applications.map((application) => application.userId);

    const cards = await prisma.taskCard.findMany({
      where: { cohortId: cohort.id, userId: { in: participantIds } },
      orderBy: [{ date: "asc" }, { updatedAt: "desc" }]
    });

    const fioFieldIds = cohort.surveyFields
      .filter((field) => normalizeLabel(field.label).includes("фио"))
      .map((field) => field.id);

    const participants = applications
      .map((application) => ({
        userId: application.userId,
        displayName:
          application.user.documents[0]?.studentFio?.trim() ||
          answerForFields(application.answers, fioFieldIds) ||
          application.user.email,
        role: application.role,
        cards: cards.filter((card) => card.userId === application.userId)
      }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName, "ru"));

    res.json({
      cohort: {
        id: cohort.id,
        name: cohort.name,
        practiceStart: cohort.practiceStart,
        practiceEnd: cohort.practiceEnd,
        completedAt: cohort.completedAt
      },
      participants
    });
  })
);

tasksRouter.post(
  "/cohorts/:cohortId/tasks",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== UserRole.STUDENT) {
      throw forbidden("Создавать задачи могут только студенты");
    }

    const application = await requireApprovedApplication(req.user!.id, req.params.cohortId);
    if (application.cohort.completedAt) {
      throw badRequest("Практика завершена, добавление задач недоступно");
    }
    const body = asObject(req.body);
    const date = parseTaskDate(stringField(body, "date"));

    assertTaskDateAllowed(date, application.cohort.practiceStart, application.cohort.practiceEnd);

    const card = await prisma.taskCard.create({
      data: {
        userId: req.user!.id,
        cohortId: req.params.cohortId,
        date,
        title: optionalStringField(body, "title") ?? "",
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
    const card = await prisma.taskCard.findUnique({
      where: { id: req.params.taskId },
      include: { cohort: { select: { completedAt: true } } }
    });
    if (!card) {
      throw notFound("Задача не найдена");
    }
    if (card.cohort.completedAt) {
      throw badRequest("Практика завершена, изменение задач недоступно");
    }
    assertCanEditTaskCard(req.user!.role, req.user!.id, card.userId);
    if (req.user!.role !== UserRole.ADMIN) {
      const application = await requireApprovedApplication(req.user!.id, card.cohortId);
      if (application.cohort.completedAt) {
        throw badRequest("Практика завершена, изменение задач недоступно");
      }
    }

    const updated = await prisma.taskCard.update({
      where: { id: card.id },
      data: {
        title: taskTextField(body, "title", false) ?? undefined,
        description: taskTextField(body, "description", true),
        doneText: taskTextField(body, "doneText", true),
        artifactLink: taskTextField(body, "artifactLink", true)
      }
    });

    res.json({ card: updated });
  })
);

function taskTextField(body: Record<string, unknown>, name: string, nullable: boolean) {
  const value = body[name];
  if (value === undefined) {
    return undefined;
  }
  if (value === null && nullable) {
    return null;
  }
  if (typeof value !== "string") {
    throw badRequest(`Поле «${name}» должно содержать текст`);
  }

  const trimmed = value.trim();
  return nullable ? trimmed || null : trimmed;
}

function normalizeLabel(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
}

function answerForFields(value: unknown, fieldIds: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const answers = value as Record<string, unknown>;
  for (const fieldId of fieldIds) {
    const answer = answers[fieldId];
    if (typeof answer === "string" && answer.trim()) {
      return answer.trim();
    }
  }
  return "";
}

