import { Router } from "express";
import { ApplicationStatus, Prisma, SurveyFieldType, UserRole } from "@prisma/client";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { badRequest, forbidden, notFound } from "../http/errors.js";
import { prisma } from "../lib/prisma.js";
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
            surveyFields: { orderBy: { order: "asc" } }
          }
        },
        role: true
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ applications });
  })
);

applicationsRouter.post(
  "/cohorts/:cohortId/applications",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== UserRole.STUDENT) {
      throw forbidden("Only students can submit applications");
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
      throw notFound("Cohort not found");
    }

    const now = new Date();
    if (now < cohort.applicationStart || now > cohort.applicationEnd) {
      throw badRequest("Applications are closed for this cohort");
    }

    validateApplicationAnswers(answers, cohort.surveyFields);

    const application = await prisma.application.upsert({
      where: {
        userId_cohortId: {
          userId: req.user!.id,
          cohortId: cohort.id
        }
      },
      update: {
        answers: answersJson,
        status: ApplicationStatus.PENDING,
        reviewComment: null
      },
      create: {
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

    res.status(201).json({ application });
  })
);

function validateApplicationAnswers(
  answers: Record<string, unknown>,
  surveyFields: Array<{
    id: string;
    label: string;
    type: SurveyFieldType;
    options: unknown;
    required: boolean;
  }>
) {
  for (const field of surveyFields) {
    const value = answers[field.id];

    if (field.required && isEmptyAnswer(value)) {
      throw badRequest(`Field "${field.label}" is required`);
    }

    if (isEmptyAnswer(value)) {
      continue;
    }

    if (typeof value !== "string") {
      throw badRequest(`Field "${field.label}" must be a string`);
    }

    if (field.type === SurveyFieldType.SELECT) {
      const options = Array.isArray(field.options) ? field.options : [];
      const stringOptions = options.filter((option): option is string => typeof option === "string");

      if (stringOptions.length > 0 && !stringOptions.includes(value)) {
        throw badRequest(`Unsupported option for field "${field.label}"`);
      }
    }
  }
}

function isEmptyAnswer(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && value.trim().length === 0);
}

adminApplicationsRouter.use(requireAuth, requireAdmin);

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
      throw badRequest(`Unsupported application status: ${status}`);
    }

    const application = await prisma.application.findUnique({
      where: { id: req.params.applicationId }
    });

    if (!application) {
      throw notFound("Application not found");
    }

    if (roleId) {
      const role = await prisma.cohortRole.findFirst({
        where: { id: roleId, cohortId: application.cohortId }
      });
      if (!role) {
        throw badRequest("Role does not belong to the application cohort");
      }
    }

    const updated = await prisma.application.update({
      where: { id: application.id },
      data: {
        status: status as ApplicationStatus,
        roleId: status === ApplicationStatus.APPROVED ? roleId : null,
        reviewComment: status === ApplicationStatus.REJECTED ? reviewComment : null
      },
      include: {
        user: { select: { id: true, email: true } },
        role: true
      }
    });

    res.json({ application: updated });
  })
);

