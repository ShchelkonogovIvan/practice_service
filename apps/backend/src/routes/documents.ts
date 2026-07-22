import { randomUUID } from "node:crypto";
import { access, unlink } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { ApplicationStatus, ReportReviewStatus } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { badRequest, forbidden, notFound } from "../http/errors.js";
import { requireApprovedApplication } from "../lib/cohort-access.js";
import { generatePracticeDocument, PracticeDocumentKind } from "../lib/document-generator.js";
import { documentReadiness, writableReviewFields, writableStudentFields } from "../lib/document-readiness.js";
import { formatShortFio } from "../lib/document-names.js";
import { notifyReportReview } from "../lib/notifications.js";
import { createAdminNotifications, createUserNotification } from "../lib/in-app-notifications.js";
import { reportReviewContent, reportUploadedContent } from "../lib/notification-content.js";
import { assertValidReportFile } from "../lib/report-file.js";
import { prisma } from "../lib/prisma.js";
import { asObject, stringField } from "../utils/body.js";

export const documentsRouter = Router();
export const adminDocumentsRouter = Router();

const reportDirectory = path.join(env.uploadsDir, "reports");
mkdirSync(reportDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: reportDirectory,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = new Set([".docx", ".pdf"]);
    const allowedMimeTypes = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]);

    if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimetype)) {
      callback(badRequest("Допустимые форматы отчёта: docx, pdf"));
      return;
    }

    callback(null, true);
  }
});

documentsRouter.use(requireAuth);

documentsRouter.get(
  "/cohorts/:cohortId/documents/me",
  asyncHandler(async (req, res) => {
    await requireApprovedApplication(req.user!.id, req.params.cohortId);
    const data = await ensureDocumentData(req.user!.id, req.params.cohortId);
    res.json({ data, readiness: documentReadiness(data) });
  })
);

documentsRouter.put(
  "/cohorts/:cohortId/documents/me",
  asyncHandler(async (req, res) => {
    await requireApprovedApplication(req.user!.id, req.params.cohortId);
    const body = asObject(req.body);
    const values = pickStrings(body, writableStudentFields);

    const data = await prisma.studentDocumentData.upsert({
      where: {
        userId_cohortId: {
          userId: req.user!.id,
          cohortId: req.params.cohortId
        }
      },
      update: values,
      create: {
        userId: req.user!.id,
        cohortId: req.params.cohortId,
        ...values
      }
    });

    res.json({ data, readiness: documentReadiness(data) });
  })
);

documentsRouter.post(
  "/cohorts/:cohortId/documents/me/report",
  asyncHandler(async (req, _res, next) => {
    await requireApprovedApplication(req.user!.id, req.params.cohortId);
    next();
  }),
  upload.single("report"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw badRequest("Выберите файл отчёта");
    }

    try {
      await assertValidReportFile(req.file.path, req.file.originalname);
      const existing = await findDocumentData(req.user!.id, req.params.cohortId);
      const reportFileName = decodeUploadFilename(req.file.originalname);
      const data = await prisma.studentDocumentData.upsert({
        where: {
          userId_cohortId: {
            userId: req.user!.id,
            cohortId: req.params.cohortId
          }
        },
        update: {
          reportFileUrl: `reports/${req.file.filename}`,
          reportFileName,
          reportUploadedAt: new Date(),
          reportReviewStatus: ReportReviewStatus.PENDING,
          reportReviewComment: null
        },
        create: {
          userId: req.user!.id,
          cohortId: req.params.cohortId,
          reportFileUrl: `reports/${req.file.filename}`,
          reportFileName,
          reportUploadedAt: new Date(),
          reportReviewStatus: ReportReviewStatus.PENDING
        }
      });

      if (existing?.reportFileUrl) {
        await removeReport(existing.reportFileUrl);
      }

      const cohort = await prisma.cohort.findUniqueOrThrow({
        where: { id: req.params.cohortId },
        select: { name: true }
      });
      await createAdminNotifications(reportUploadedContent(cohort.name, req.user!.email)).catch(() => undefined);

      res.status(201).json({ data, readiness: documentReadiness(data) });
    } catch (error) {
      await unlink(req.file.path).catch(() => undefined);
      throw error;
    }
  })
);

documentsRouter.get(
  "/cohorts/:cohortId/documents/me/report",
  asyncHandler(async (req, res) => {
    await requireApprovedApplication(req.user!.id, req.params.cohortId);
    const data = await findDocumentData(req.user!.id, req.params.cohortId);
    await sendReport(res, data?.reportFileUrl, data?.reportFileName);
  })
);

documentsRouter.get(
  "/cohorts/:cohortId/documents/me/generate/:kind",
  asyncHandler(async (req, res) => {
    const application = await requireApprovedApplication(req.user!.id, req.params.cohortId);
    const data = await findDocumentData(req.user!.id, req.params.cohortId);
    const kind = parseDocumentKind(req.params.kind);
    assertCanGenerate(kind, data);

    const buffer = generatePracticeDocument(kind, templateData(kind, data!, application.cohort));
    const filename = documentFilename(kind);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${documentFallbackFilename(kind)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.send(buffer);
  })
);

adminDocumentsRouter.use(requireAuth, requireAdmin);

adminDocumentsRouter.get(
  "/cohorts/:cohortId/documents",
  asyncHandler(async (req, res) => {
    const applications = await prisma.application.findMany({
      where: {
        cohortId: req.params.cohortId,
        status: ApplicationStatus.APPROVED
      },
      include: {
        role: true,
        user: {
          select: {
            id: true,
            email: true,
            documents: {
              where: { cohortId: req.params.cohortId }
            }
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    const rows = applications.map((application) => {
      const storedData = application.user.documents[0] ?? null;
      const data = storedData ? normalizeDocumentFilename(storedData) : null;
      return {
        applicationId: application.id,
        user: { id: application.user.id, email: application.user.email },
        role: application.role,
        data,
        readiness: documentReadiness(data)
      };
    });

    res.json({ rows });
  })
);

adminDocumentsRouter.put(
  "/cohorts/:cohortId/documents/:userId/review",
  asyncHandler(async (req, res) => {
    await requireApprovedApplication(req.params.userId, req.params.cohortId);
    const body = asObject(req.body);
    const values = Object.fromEntries(
      writableReviewFields.map((field) => [field, stringField(body, field)])
    ) as Record<(typeof writableReviewFields)[number], string>;

    const data = await prisma.studentDocumentData.upsert({
      where: {
        userId_cohortId: {
          userId: req.params.userId,
          cohortId: req.params.cohortId
        }
      },
      update: values,
      create: {
        userId: req.params.userId,
        cohortId: req.params.cohortId,
        ...values
      }
    });

    res.json({ data, readiness: documentReadiness(data) });
  })
);

adminDocumentsRouter.patch(
  "/cohorts/:cohortId/documents/:userId/report-review",
  asyncHandler(async (req, res) => {
    await requireApprovedApplication(req.params.userId, req.params.cohortId);
    const body = asObject(req.body);
    const status = stringField(body, "status").toUpperCase();
    const comment = typeof body.comment === "string" ? body.comment.trim() || null : null;
    if (!Object.values(ReportReviewStatus).includes(status as ReportReviewStatus)) {
      throw badRequest(`Недопустимый статус проверки отчёта: ${status}`);
    }
    if (status === ReportReviewStatus.CHANGES_REQUESTED && !comment) {
      throw badRequest("Комментарий обязателен, если отчёт требует исправлений");
    }

    const existing = await findDocumentData(req.params.userId, req.params.cohortId);
    if (!existing?.reportFileUrl) {
      throw badRequest("Сначала практикант должен загрузить отчёт");
    }

    const data = await prisma.studentDocumentData.update({
      where: { id: existing.id },
      data: {
        reportReviewStatus: status as ReportReviewStatus,
        reportReviewComment: comment
      }
    });

    const [user, cohort] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: req.params.userId }, select: { email: true } }),
      prisma.cohort.findUniqueOrThrow({ where: { id: req.params.cohortId }, select: { name: true } })
    ]);
    const notification = await notifyReportReview(
      user.email,
      cohort.name,
      status as ReportReviewStatus,
      comment
    );
    await createUserNotification(
      req.params.userId,
      reportReviewContent(cohort.name, status as ReportReviewStatus, comment)
    ).catch(() => undefined);

    res.json({ data, readiness: documentReadiness(data), notification });
  })
);

adminDocumentsRouter.get(
  "/cohorts/:cohortId/documents/:userId/report",
  asyncHandler(async (req, res) => {
    await requireApprovedApplication(req.params.userId, req.params.cohortId);
    const data = await findDocumentData(req.params.userId, req.params.cohortId);
    await sendReport(res, data?.reportFileUrl, data?.reportFileName);
  })
);

async function findDocumentData(userId: string, cohortId: string) {
  const data = await prisma.studentDocumentData.findUnique({
    where: { userId_cohortId: { userId, cohortId } }
  });

  if (!data) return null;

  const normalized = normalizeDocumentFilename(data);
  if (normalized.reportFileName !== data.reportFileName) {
    return prisma.studentDocumentData.update({
      where: { id: data.id },
      data: { reportFileName: normalized.reportFileName }
    });
  }

  return data;
}

async function ensureDocumentData(userId: string, cohortId: string) {
  const existing = await findDocumentData(userId, cohortId);
  if (existing) return existing;

  const application = await prisma.application.findUnique({
    where: { userId_cohortId: { userId, cohortId } },
    include: {
      cohort: {
        select: { surveyFields: { select: { id: true, label: true } } }
      }
    }
  });
  const answers = jsonRecord(application?.answers);
  let studentFio: string | undefined;
  let group: string | undefined;

  for (const field of application?.cohort.surveyFields ?? []) {
    const value = answers[field.id];
    if (typeof value !== "string" || !value.trim()) continue;
    const label = field.label.trim().toLocaleLowerCase("ru-RU");
    if (!studentFio && (label.includes("фио") || label.includes("ф.и.о"))) {
      studentFio = value.trim();
    }
    if (!group && label.includes("групп")) {
      group = value.trim();
    }
  }

  return prisma.studentDocumentData.upsert({
    where: { userId_cohortId: { userId, cohortId } },
    update: {},
    create: { userId, cohortId, studentFio, group }
  });
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeDocumentFilename<T extends { reportFileName: string | null }>(data: T): T {
  if (!data.reportFileName) return data;
  return { ...data, reportFileName: decodeUploadFilename(data.reportFileName) };
}

function decodeUploadFilename(filename: string) {
  if (!/[ÃÂÐÑ]/.test(filename)) return filename;
  const decoded = Buffer.from(filename, "latin1").toString("utf8");
  return decoded.includes("\uFFFD") ? filename : decoded;
}

function pickStrings<T extends readonly string[]>(body: Record<string, unknown>, keys: T) {
  return keys.reduce<Record<string, string>>((result, key) => {
    const value = body[key];
    if (typeof value === "string") {
      result[key] = value.trim();
    }
    return result;
  }, {});
}

function parseDocumentKind(value: string): PracticeDocumentKind {
  if (value === "individual-assignment" || value === "review" || value === "title-page") {
    return value;
  }
  throw notFound("Недопустимый тип документа");
}

function assertCanGenerate(kind: PracticeDocumentKind, data: Record<string, unknown> | null) {
  const readiness = documentReadiness(data);
  if (kind === "individual-assignment" && !readiness.individualReady) {
    throw badRequest(readiness.individualReason ?? "Индивидуальное задание пока недоступно");
  }
  if (kind === "review" && !readiness.reviewReady) {
    throw badRequest(readiness.reviewReason ?? "Отзыв пока недоступен");
  }
  if (kind === "title-page" && !readiness.titleReady) {
    throw badRequest(readiness.titleReason ?? "Титульный лист пока недоступен");
  }
}

function templateData(
  kind: PracticeDocumentKind,
  data: NonNullable<Awaited<ReturnType<typeof findDocumentData>>>,
  cohort: { practiceStart: Date; practiceEnd: Date }
) {
  return {
    student_fio: kind === "individual-assignment"
      ? data.studentFioGenitive ?? ""
      : formatShortFio(data.studentFio),
    group: data.group ?? "",
    direction_code: data.directionCode ?? "",
    direction_name: data.directionName ?? "",
    program_name: data.programName ?? "",
    specialty: data.specialty ?? "",
    practice_topic: data.practiceTopic ?? "",
    main_stage_tasks: data.mainStageTasks ?? "",
    supervisor_urfu_name: data.supervisorUrfuName ?? "",
    review_activities: data.reviewActivities ?? "",
    review_characteristic: data.reviewCharacteristic ?? "",
    review_employed: data.reviewEmployed ?? "",
    review_next_practice: data.reviewNextPractice ?? "",
    review_employment_offer: data.reviewEmploymentOffer ?? "",
    review_suggestions: data.reviewSuggestions ?? "",
    review_grade: data.reviewGrade ?? "",
    practice_start: formatDate(cohort.practiceStart),
    practice_end: formatDate(cohort.practiceEnd),
    year: String(cohort.practiceStart.getFullYear()),
    city_year: `Екатеринбург, ${cohort.practiceStart.getFullYear()}`,
    institute: "ИРИТ-РТФ",
    department: "школа бакалавриата (школа)",
    practice_place: "ИП Езуб Антон Сергеевич, удалённое прохождение",
    practice_type: "Производственная практика",
    practice_kind: "Производственная практика, технологическая",
    report_contents: "введение, описание работы, результат практики, заключение, список использованных источников",
    supervisor_company: "Езуб Антон Сергеевич"
  };
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU").format(value);
}

function documentFilename(kind: PracticeDocumentKind) {
  return {
    "individual-assignment": "Индивидуальное задание.docx",
    review: "Отзыв о практике.docx",
    "title-page": "Титульный лист отчёта.docx"
  }[kind];
}

function documentFallbackFilename(kind: PracticeDocumentKind) {
  return {
    "individual-assignment": "individual-assignment.docx",
    review: "practice-review.docx",
    "title-page": "report-title-page.docx"
  }[kind];
}

async function sendReport(
  res: Parameters<Parameters<typeof asyncHandler>[0]>[1],
  fileUrl: string | null | undefined,
  fileName: string | null | undefined
) {
  if (!fileUrl) {
    throw notFound("Отчёт не загружен");
  }

  const filePath = resolveReportPath(fileUrl);
  await access(filePath).catch(() => {
    throw notFound("Файл отчёта не найден");
  });
  res.download(filePath, fileName ?? "practice-report");
}

function resolveReportPath(fileUrl: string) {
  const uploadsRoot = path.resolve(env.uploadsDir);
  const filePath = path.resolve(uploadsRoot, fileUrl);
  if (!filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw forbidden("Некорректный путь к файлу отчёта");
  }
  return filePath;
}

async function removeReport(fileUrl: string) {
  await unlink(resolveReportPath(fileUrl)).catch(() => undefined);
}
