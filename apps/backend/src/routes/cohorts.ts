import { Router } from "express";
import { ApplicationStatus, SurveyFieldType } from "@prisma/client";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { badRequest, notFound } from "../http/errors.js";
import { prisma } from "../lib/prisma.js";
import { notifyTestTaskPublished } from "../lib/notifications.js";
import { createUserNotifications } from "../lib/in-app-notifications.js";
import { testTaskContent as buildTestTaskNotification } from "../lib/notification-content.js";
import { assertSurveyFieldChangesAllowed } from "../lib/survey-policy.js";
import { asObject, dateField, optionalStringField, stringField } from "../utils/body.js";

export const cohortsRouter = Router();
export const publicCohortsRouter = Router();

const cohortInclude = {
  surveyFields: { orderBy: { order: "asc" as const } },
  roles: { orderBy: { name: "asc" as const } },
  testTask: true
};

const publicCohortInclude = {
  surveyFields: { orderBy: { order: "asc" as const } },
  roles: { orderBy: { name: "asc" as const } }
};

publicCohortsRouter.get(
  "/active",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const cohorts = await prisma.cohort.findMany({
      where: {
        applicationStart: { lte: now },
        applicationEnd: { gte: now },
        completedAt: null
      },
      include: publicCohortInclude,
      orderBy: { applicationEnd: "asc" }
    });

    const publicCohorts = cohorts.map((cohort) => ({ ...cohort, testTask: null }));
    res.json({ cohort: publicCohorts[0] ?? null, cohorts: publicCohorts });
  })
);

publicCohortsRouter.get(
  "/:cohortId",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const cohort = await prisma.cohort.findFirst({
      where: {
        id: req.params.cohortId,
        applicationStart: { lte: now },
        applicationEnd: { gte: now },
        completedAt: null
      },
      include: publicCohortInclude
    });

    if (!cohort) {
      throw notFound("Когорта не принимает заявки");
    }

    res.json({ cohort: { ...cohort, testTask: null } });
  })
);

cohortsRouter.use(requireAuth, requireAdmin);

cohortsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const cohorts = await prisma.cohort.findMany({
      include: cohortInclude,
      orderBy: { practiceStart: "desc" }
    });

    res.json({ cohorts });
  })
);

cohortsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = asObject(req.body);
    const name = stringField(body, "name");
    const applicationStart = dateField(body, "applicationStart");
    const applicationEnd = dateField(body, "applicationEnd");
    const practiceStart = dateField(body, "practiceStart");
    const practiceEnd = dateField(body, "practiceEnd");
    const surveyFields = parseSurveyFields(body.surveyFields);
    const roles = parseRoles(body.roles);
    const testTaskContent = optionalStringField(body, "testTaskContent");
    const testTaskPublished = body.testTaskPublished === true;

    validateCohortDates(applicationStart, applicationEnd, practiceStart, practiceEnd);

    const cohort = await prisma.cohort.create({
      data: {
        name,
        applicationStart,
        applicationEnd,
        practiceStart,
        practiceEnd,
        surveyFields: {
          create: surveyFields
        },
        roles: {
          create: roles.map((roleName) => ({ name: roleName }))
        },
        ...(testTaskContent
          ? {
              testTask: {
                create: {
                  content: testTaskContent,
                  publishedAt: testTaskPublished ? new Date() : null
                }
              }
            }
          : {})
      },
      include: cohortInclude
    });

    res.status(201).json({ cohort });
  })
);

cohortsRouter.get(
  "/:cohortId",
  asyncHandler(async (req, res) => {
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.cohortId },
      include: cohortInclude
    });

    if (!cohort) {
      throw notFound("Когорта не найдена");
    }

    res.json({ cohort });
  })
);

cohortsRouter.put(
  "/:cohortId/survey-fields",
  asyncHandler(async (req, res) => {
    const body = asObject(req.body);
    const surveyFields = parseSurveyFields(body.surveyFields);

    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.cohortId },
      include: {
        surveyFields: true,
        _count: { select: { applications: true } }
      }
    });

    if (!cohort) {
      throw notFound("Когорта не найдена");
    }

    const retainedIds = surveyFields.flatMap((field) => field.id ? [field.id] : []);
    assertSurveyFieldChangesAllowed(cohort.surveyFields, surveyFields, cohort._count.applications);

    const updated = await prisma.cohort.update({
      where: { id: cohort.id },
      data: {
        surveyFields: {
          deleteMany: { id: { notIn: retainedIds } },
          update: surveyFields.filter((field) => field.id).map(({ id, ...field }) => ({
            where: { id: id! },
            data: field
          })),
          create: surveyFields.filter((field) => !field.id).map(({ id: _id, ...field }) => field)
        }
      },
      include: cohortInclude
    });

    res.json({ cohort: updated });
  })
);

cohortsRouter.patch(
  "/:cohortId/completion",
  asyncHandler(async (req, res) => {
    const body = asObject(req.body);
    if (typeof body.completed !== "boolean") {
      throw badRequest("Передайте признак завершения когорты");
    }

    const existing = await prisma.cohort.findUnique({
      where: { id: req.params.cohortId },
      select: { id: true }
    });
    if (!existing) {
      throw notFound("Когорта не найдена");
    }

    const cohort = await prisma.cohort.update({
      where: { id: req.params.cohortId },
      data: { completedAt: body.completed ? new Date() : null },
      include: cohortInclude
    });

    res.json({ cohort });
  })
);

cohortsRouter.put(
  "/:cohortId/roles",
  asyncHandler(async (req, res) => {
    const body = asObject(req.body);
    const roles = parseRoles(body.roles);

    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.cohortId }
    });

    if (!cohort) {
      throw notFound("Когорта не найдена");
    }

    const existingRoles = await prisma.cohortRole.findMany({
      where: { cohortId: cohort.id },
      include: {
        _count: {
          select: { applications: true }
        }
      }
    });
    const nextRoleNames = new Set(roles);
    const removedAssignedRoles = existingRoles
      .filter((role) => !nextRoleNames.has(role.name) && role._count.applications > 0)
      .map((role) => role.name);

    const updated = await prisma.cohort.update({
      where: { id: cohort.id },
      data: {
        roles: {
          deleteMany: {},
          create: roles.map((roleName) => ({ name: roleName }))
        }
      },
      include: cohortInclude
    });

    res.json({
      cohort: updated,
      warning:
        removedAssignedRoles.length > 0
          ? `Удалены назначенные роли: ${removedAssignedRoles.join(", ")}`
          : null
    });
  })
);

cohortsRouter.put(
  "/:cohortId/test-task",
  asyncHandler(async (req, res) => {
    const body = asObject(req.body);
    const content = stringField(body, "content");
    const published = body.published === true;

    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.cohortId },
      include: { testTask: true }
    });

    if (!cohort) {
      throw notFound("Когорта не найдена");
    }

    const testTask = await prisma.testTask.upsert({
      where: { cohortId: cohort.id },
      update: {
        content,
        publishedAt: published ? cohort.testTask?.publishedAt ?? new Date() : null
      },
      create: {
        cohortId: cohort.id,
        content,
        publishedAt: published ? new Date() : null
      }
    });

    let notification = null;
    const shouldNotify = published && (
      !cohort.testTask?.publishedAt || cohort.testTask.content !== content
    );
    if (shouldNotify) {
      const applications = await prisma.application.findMany({
        where: {
          cohortId: cohort.id,
          status: { in: [ApplicationStatus.PENDING, ApplicationStatus.APPROVED] }
        },
        select: { user: { select: { id: true, email: true } } }
      });
      const updated = Boolean(cohort.testTask?.publishedAt);
      await createUserNotifications(
        applications.map((application) => application.user.id),
        buildTestTaskNotification(cohort.name, updated)
      ).catch(() => undefined);
      notification = await notifyTestTaskPublished(
        applications.map((application) => application.user.email),
        cohort.name,
        content,
        updated
      );
    }

    res.json({ testTask, notification });
  })
);

function parseRoles(value: unknown) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw badRequest("Роли должны быть переданы в виде списка");
  }
  return Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));
}

function parseSurveyFields(value: unknown) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw badRequest("Поля анкеты должны быть переданы в виде списка");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw badRequest("Каждое поле анкеты должно иметь корректный формат");
    }

    const field = item as Record<string, unknown>;
    const label = stringField(field, "label");
    const type = stringField(field, "type").toUpperCase();

    if (!Object.values(SurveyFieldType).includes(type as SurveyFieldType)) {
      throw badRequest(`Недопустимый тип поля анкеты: ${type}`);
    }

    const options = type === SurveyFieldType.SELECT
      ? Array.isArray(field.options)
        ? field.options.filter((option): option is string => typeof option === "string" && option.trim().length > 0)
        : []
      : undefined;
    if (type === SurveyFieldType.SELECT && options?.length === 0) {
      throw badRequest(`Добавьте варианты ответа для поля «${label}»`);
    }

    return {
      id: typeof field.id === "string" && field.id.trim() ? field.id.trim() : undefined,
      label,
      type: type as SurveyFieldType,
      order: typeof field.order === "number" ? field.order : index,
      required: typeof field.required === "boolean" ? field.required : true,
      options
    };
  });
}

function validateCohortDates(applicationStart: Date, applicationEnd: Date, practiceStart: Date, practiceEnd: Date) {
  if (applicationStart > applicationEnd) {
    throw badRequest("Дата окончания приёма заявок должна быть позже даты начала");
  }

  if (practiceStart > practiceEnd) {
    throw badRequest("Дата окончания практики должна быть позже даты начала");
  }

  if (applicationEnd > practiceStart) {
    throw badRequest("Приём заявок должен завершиться до начала практики");
  }
}
