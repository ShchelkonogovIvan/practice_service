import { Router } from "express";
import { ApplicationStatus, UserRole } from "@prisma/client";
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
      include: { cohort: true, role: true },
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
    const answers = jsonObjectField(body, "answers");

    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.cohortId }
    });

    if (!cohort) {
      throw notFound("Cohort not found");
    }

    const now = new Date();
    if (now < cohort.applicationStart || now > cohort.applicationEnd) {
      throw badRequest("Applications are closed for this cohort");
    }

    const application = await prisma.application.upsert({
      where: {
        userId_cohortId: {
          userId: req.user!.id,
          cohortId: cohort.id
        }
      },
      update: {
        answers,
        status: ApplicationStatus.PENDING,
        reviewComment: null
      },
      create: {
        userId: req.user!.id,
        cohortId: cohort.id,
        answers
      },
      include: { cohort: true, role: true }
    });

    res.status(201).json({ application });
  })
);

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

