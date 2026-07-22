import { Router } from "express";
import { ApplicationStatus, Prisma, UserRole } from "@prisma/client";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { badRequest, forbidden, notFound } from "../http/errors.js";
import { prisma } from "../lib/prisma.js";
import { assertApplicationDecision, assertApplicationEditable, validateApplicationAnswers } from "../lib/application-policy.js";
import { notifyApplicationDecision } from "../lib/notifications.js";
import { createAdminNotifications, createUserNotification } from "../lib/in-app-notifications.js";
import { applicationDecisionContent, applicationSubmittedContent } from "../lib/notification-content.js";
import { buildCohortCsv } from "../lib/cohort-export.js";
import { asObject, jsonObjectField, optionalStringField, stringField } from "../utils/body.js";

export const applicationsRouter = Router();
export const adminApplicationsRouter = Router();

applicationsRouter.use(requireAuth);

applicationsRouter.get(
  "/me/applications",
  asyncHandler(async (req, res) => {
    const applications = await prisma.application.findMany({
      where: { userId: req.user!.id },
      include: {
        cohort: {
          include: {
            surveyFields: { orderBy: { order: "asc" } },
            testTask: true
          }
        },
        role: true
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({
      applications: applications.map((application) => ({
        ...application,
        cohort: {
          ...application.cohort,
          testTask: application.cohort.testTask?.publishedAt ? application.cohort.testTask : null
        }
      }))
    });
  })
);

applicationsRouter.post(
  "/cohorts/:cohortId/applications",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== UserRole.STUDENT) {
      throw forbidden("Подавать заявки могут только студенты");
    }

    const body = asObject(req.body);
    const answers = jsonObjectField(body, "answers") as Record<string, unknown>;
    const answersJson = answers as Prisma.InputJsonObject;

    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.cohortId },
      include: {
        surveyFields: { orderBy: { order: "asc" } }
      }
    });

    if (!cohort) {
      throw notFound("Когорта не найдена");
    }

    const now = new Date();
    if (cohort.completedAt || now < cohort.applicationStart || now > cohort.applicationEnd) {
      throw badRequest("Приём заявок в эту когорту закрыт");
    }

    validateApplicationAnswers(answers, cohort.surveyFields);

    const existingApplication = await prisma.application.findUnique({
      where: { userId_cohortId: { userId: req.user!.id, cohortId: cohort.id } },
      select: { id: true }
    });

    if (existingApplication) {
      throw badRequest("Заявка в эту когорту уже существует");
    }

    const application = await prisma.application.create({
      data: {
        userId: req.user!.id,
        cohortId: cohort.id,
        answers: answersJson
      },
      include: {
        cohort: {
          include: {
            surveyFields: { orderBy: { order: "asc" } }
          }
        },
        role: true
      }
    });

    await createAdminNotifications(applicationSubmittedContent(cohort.name, req.user!.email)).catch(() => undefined);

    res.status(201).json({ application });
  })
);

applicationsRouter.patch(
  "/applications/:applicationId",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== UserRole.STUDENT) {
      throw forbidden("Редактировать заявки могут только студенты");
    }

    const body = asObject(req.body);
    const answers = jsonObjectField(body, "answers") as Record<string, unknown>;
    const application = await prisma.application.findFirst({
      where: { id: req.params.applicationId, userId: req.user!.id },
      include: {
        cohort: { include: { surveyFields: { orderBy: { order: "asc" } } } }
      }
    });

    if (!application) {
      throw notFound("Заявка не найдена");
    }

    if (application.cohort.completedAt) {
      throw badRequest("Практика завершена, изменение заявки недоступно");
    }

    assertApplicationEditable(application.status);
    validateApplicationAnswers(answers, application.cohort.surveyFields);

    const result = await prisma.application.updateMany({
      where: {
        id: application.id,
        userId: req.user!.id,
        status: ApplicationStatus.PENDING
      },
      data: { answers: answers as Prisma.InputJsonObject }
    });

    if (result.count !== 1) {
      throw badRequest("Статус заявки изменился. Обновите страницу и повторите попытку");
    }

    const updated = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
      include: {
        cohort: {
          include: {
            surveyFields: { orderBy: { order: "asc" } },
            testTask: true
          }
        },
        role: true
      }
    });

    res.json({ application: updated });
  })
);

adminApplicationsRouter.use(requireAuth, requireAdmin);

adminApplicationsRouter.get(
  "/cohorts/:cohortId/export.csv",
  asyncHandler(async (req, res) => {
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.cohortId },
      include: {
        surveyFields: { orderBy: { order: "asc" } },
        applications: {
          include: {
            user: { select: { id: true, email: true } },
            role: true
          },
          orderBy: { createdAt: "asc" }
        },
        documents: true,
        taskCards: { select: { userId: true, doneText: true } }
      }
    });

    if (!cohort) {
      throw notFound("Когорта не найдена");
    }

    const csv = buildCohortCsv(cohort.surveyFields, cohort.applications, cohort.documents, cohort.taskCards);
    const fileName = `Когорта ${cohort.name}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="cohort-export.csv"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(csv);
  })
);

adminApplicationsRouter.get(
  "/cohorts/:cohortId/applications",
  asyncHandler(async (req, res) => {
    const applications = await prisma.application.findMany({
      where: { cohortId: req.params.cohortId },
      include: {
        user: { select: { id: true, email: true, createdAt: true } },
        role: true
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ applications });
  })
);

adminApplicationsRouter.patch(
  "/applications/:applicationId/status",
  asyncHandler(async (req, res) => {
    const body = asObject(req.body);
    const status = stringField(body, "status").toUpperCase();
    const roleId = optionalStringField(body, "roleId");
    const reviewComment = optionalStringField(body, "reviewComment");

    if (!Object.values(ApplicationStatus).includes(status as ApplicationStatus)) {
      throw badRequest(`Недопустимый статус заявки: ${status}`);
    }

    const application = await prisma.application.findUnique({
      where: { id: req.params.applicationId }
    });

    if (!application) {
      throw notFound("Заявка не найдена");
    }

    assertApplicationDecision(status as ApplicationStatus, roleId, reviewComment);

    if (roleId) {
      const role = await prisma.cohortRole.findFirst({
        where: { id: roleId, cohortId: application.cohortId }
      });
      if (!role) {
        throw badRequest("Выбранная роль не относится к когорте заявки");
      }
    }

    const updated = await prisma.application.update({
      where: { id: application.id },
      data: {
        status: status as ApplicationStatus,
        roleId: status === ApplicationStatus.APPROVED ? roleId : null,
        reviewComment: status === ApplicationStatus.REJECTED || status === ApplicationStatus.REMOVED
          ? reviewComment
          : null
      },
      include: {
        user: { select: { id: true, email: true } },
        cohort: { select: { name: true } },
        role: true
      }
    });

    const notification = await notifyApplicationDecision(
      updated.user.email,
      updated.cohort.name,
      updated.status,
      updated.reviewComment
    );
    await createUserNotification(
      updated.user.id,
      applicationDecisionContent(updated.cohort.name, updated.status, updated.reviewComment)
    ).catch(() => undefined);

    res.json({ application: updated, notification });
  })
);

