import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { notFound } from "../http/errors.js";
import { prisma } from "../lib/prisma.js";
import { asObject } from "../utils/body.js";

export const documentsRouter = Router();
export const adminDocumentsRouter = Router();

const writableStudentFields = [
  "studentFio",
  "group",
  "directionCode",
  "directionName",
  "programName",
  "specialty",
  "practiceTopic",
  "mainStageTasks",
  "reportFileUrl"
] as const;

const writableReviewFields = [
  "reviewActivities",
  "reviewCharacteristic",
  "reviewEmployed",
  "reviewNextPractice",
  "reviewEmploymentOffer",
  "reviewSuggestions",
  "reviewGrade",
  "reportAdminApproved"
] as const;

documentsRouter.use(requireAuth);

documentsRouter.get(
  "/cohorts/:cohortId/documents/me",
  asyncHandler(async (req, res) => {
    const data = await prisma.studentDocumentData.findUnique({
      where: {
        userId_cohortId: {
          userId: req.user!.id,
          cohortId: req.params.cohortId
        }
      }
    });

    res.json({ data });
  })
);

documentsRouter.put(
  "/cohorts/:cohortId/documents/me",
  asyncHandler(async (req, res) => {
    const body = asObject(req.body);
    const data = pick(body, writableStudentFields);

    const documentData = await prisma.studentDocumentData.upsert({
      where: {
        userId_cohortId: {
          userId: req.user!.id,
          cohortId: req.params.cohortId
        }
      },
      update: data,
      create: {
        userId: req.user!.id,
        cohortId: req.params.cohortId,
        ...data
      }
    });

    res.json({ data: documentData });
  })
);

adminDocumentsRouter.use(requireAuth, requireAdmin);

adminDocumentsRouter.get(
  "/cohorts/:cohortId/documents",
  asyncHandler(async (req, res) => {
    const rows = await prisma.studentDocumentData.findMany({
      where: { cohortId: req.params.cohortId },
      include: {
        user: { select: { id: true, email: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    res.json({ rows });
  })
);

adminDocumentsRouter.put(
  "/cohorts/:cohortId/documents/:userId/review",
  asyncHandler(async (req, res) => {
    const body = asObject(req.body);
    const existing = await prisma.studentDocumentData.findUnique({
      where: {
        userId_cohortId: {
          userId: req.params.userId,
          cohortId: req.params.cohortId
        }
      }
    });

    if (!existing) {
      throw notFound("Student document data not found");
    }

    const data = await prisma.studentDocumentData.update({
      where: { id: existing.id },
      data: pick(body, writableReviewFields)
    });

    res.json({ data });
  })
);

function pick<T extends readonly string[]>(body: Record<string, unknown>, keys: T) {
  return keys.reduce<Record<string, string | boolean>>((result, key) => {
    const value = body[key];
    if (typeof value === "string" || typeof value === "boolean") {
      result[key] = value;
    }
    return result;
  }, {});
}

