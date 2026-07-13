import { Router } from "express";
import { SurveyFieldType } from "@prisma/client";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { badRequest, notFound } from "../http/errors.js";
import { prisma } from "../lib/prisma.js";
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
        applicationEnd: { gte: now }
      },
      include: publicCohortInclude,
      orderBy: { applicationEnd: "asc" }
    });

    const publicCohorts = cohorts.map((cohort) => ({ ...cohort, testTask: null }));
    res.json({ cohort: publicCohorts[0] ?? null, cohorts: publicCohorts });
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
      throw notFound("Cohort not found");
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
      where: { id: req.params.cohortId }
    });

    if (!cohort) {
      throw notFound("Cohort not found");
    }

    const updated = await prisma.cohort.update({
      where: { id: cohort.id },
      data: {
        surveyFields: {
          deleteMany: {},
          create: surveyFields
        }
      },
      include: cohortInclude
    });

    res.json({ cohort: updated });
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
      throw notFound("Cohort not found");
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
          ? `Removed assigned roles: ${removedAssignedRoles.join(", ")}`
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
      where: { id: req.params.cohortId }
    });

    if (!cohort) {
      throw notFound("Cohort not found");
    }

    const testTask = await prisma.testTask.upsert({
      where: { cohortId: cohort.id },
      update: {
        content,
        publishedAt: published ? new Date() : null
      },
      create: {
        cohortId: cohort.id,
        content,
        publishedAt: published ? new Date() : null
      }
    });

    res.json({ testTask });
  })
);

function parseRoles(value: unknown) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw badRequest("Field \"roles\" must be an array of strings");
  }
  return Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));
}

function parseSurveyFields(value: unknown) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw badRequest("Field \"surveyFields\" must be an array");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw badRequest("Each survey field must be an object");
    }

    const field = item as Record<string, unknown>;
    const label = stringField(field, "label");
    const type = stringField(field, "type").toUpperCase();

    if (!Object.values(SurveyFieldType).includes(type as SurveyFieldType)) {
      throw badRequest(`Unsupported survey field type: ${type}`);
    }

    return {
      label,
      type: type as SurveyFieldType,
      order: typeof field.order === "number" ? field.order : index,
      required: typeof field.required === "boolean" ? field.required : true,
      options: field.options ?? undefined
    };
  });
}

function validateCohortDates(applicationStart: Date, applicationEnd: Date, practiceStart: Date, practiceEnd: Date) {
  if (applicationStart > applicationEnd) {
    throw badRequest("Application end date must be later than application start date");
  }

  if (practiceStart > practiceEnd) {
    throw badRequest("Practice end date must be later than practice start date");
  }

  if (applicationEnd > practiceStart) {
    throw badRequest("Application period must finish before practice starts");
  }
}
