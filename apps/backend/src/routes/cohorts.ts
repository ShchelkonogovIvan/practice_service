import { Router } from "express";
import { SurveyFieldType } from "@prisma/client";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { badRequest, notFound } from "../http/errors.js";
import { prisma } from "../lib/prisma.js";
import { asObject, dateField, stringField } from "../utils/body.js";

export const cohortsRouter = Router();
export const publicCohortsRouter = Router();

const cohortInclude = {
  surveyFields: { orderBy: { order: "asc" as const } },
  roles: { orderBy: { name: "asc" as const } },
  testTask: true
};

publicCohortsRouter.get(
  "/active",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const cohort = await prisma.cohort.findFirst({
      where: {
        applicationStart: { lte: now },
        applicationEnd: { gte: now }
      },
      include: cohortInclude,
      orderBy: { applicationEnd: "asc" }
    });

    res.json({ cohort });
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
        }
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

