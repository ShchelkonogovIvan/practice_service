import { randomUUID } from "node:crypto";
import { access, unlink } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { ApplicationStatus, Prisma, ReportReviewStatus, UserRole } from "@prisma/client";
import multer from "multer";
import { env } from "../config/env.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { badRequest, forbidden, notFound } from "../http/errors.js";
import { prisma } from "../lib/prisma.js";
import { assertApplicationDecision, assertApplicationEditable, validateApplicationAnswers } from "../lib/application-policy.js";
import { notifyApplicationDecision } from "../lib/notifications.js";
import { createAdminNotifications, createUserNotification } from "../lib/in-app-notifications.js";
import { applicationDecisionContent, applicationSubmittedContent } from "../lib/notification-content.js";
import { buildCohortCsv } from "../lib/cohort-export.js";
import { assertValidReportFile } from "../lib/report-file.js";
import { assertPracticeOpen } from "../lib/practice-period.js";
import { asObject, jsonObjectField, optionalStringField, stringField } from "../utils/body.js";

export const applicationsRouter = Router();
export const adminApplicationsRouter = Router();

const testTaskDirectory = path.join(env.uploadsDir, "test-task-submissions");
mkdirSync(testTaskDirectory, { recursive: true });

const testTaskUpload = multer({
  storage: multer.diskStorage({
    destination: testTaskDirectory,
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
      callback(badRequest("Допустимые форматы ответа: docx, pdf"));
      return;
    }
    callback(null, true);
  }
});

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

    assertPracticeOpen(application.cohort);

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

applicationsRouter.put(
  "/applications/:applicationId/test-task-answer",
  asyncHandler(async (req, res) => {
    const application = await findEditableTestTaskApplication(req.params.applicationId, req.user!.id);
    const body = asObject(req.body);
    const answer = nullableText(body, "answer");
    const artifactLink = nullableText(body, "artifactLink");
    assertSafeArtifactLink(artifactLink);

    if (!answer && !artifactLink && !application.testTaskFileUrl) {
      throw badRequest("Добавьте текст ответа, ссылку или файл");
    }

    const updated = await prisma.application.update({
      where: { id: application.id },
      data: {
        testTaskAnswer: answer,
        testTaskArtifactLink: artifactLink,
        testTaskSubmittedAt: new Date(),
        testTaskReviewStatus: ReportReviewStatus.PENDING,
        testTaskReviewComment: null
      },
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

    await notifyAdminsAboutTestTask(application.cohort.name, req.user!.email).catch(() => undefined);
    res.json({ application: updated });
  })
);

applicationsRouter.post(
  "/applications/:applicationId/test-task-file",
  asyncHandler(async (req, _res, next) => {
    await findEditableTestTaskApplication(req.params.applicationId, req.user!.id);
    next();
  }),
  testTaskUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw badRequest("Выберите файл ответа");
    }

    try {
      await assertValidReportFile(req.file.path, req.file.originalname, "ответа");
      const application = await findEditableTestTaskApplication(req.params.applicationId, req.user!.id);
      const updated = await prisma.application.update({
        where: { id: application.id },
        data: {
          testTaskFileUrl: `test-task-submissions/${req.file.filename}`,
          testTaskFileName: decodeUploadFilename(req.file.originalname),
          testTaskSubmittedAt: new Date(),
          testTaskReviewStatus: ReportReviewStatus.PENDING,
          testTaskReviewComment: null
        },
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

      if (application.testTaskFileUrl) {
        await removeTestTaskFile(application.testTaskFileUrl);
      }
      await notifyAdminsAboutTestTask(application.cohort.name, req.user!.email).catch(() => undefined);
      res.status(201).json({ application: updated });
    } catch (error) {
      await unlink(req.file.path).catch(() => undefined);
      throw error;
    }
  })
);

applicationsRouter.get(
  "/applications/:applicationId/test-task-file",
  asyncHandler(async (req, res) => {
    const application = await prisma.application.findFirst({
      where: { id: req.params.applicationId, userId: req.user!.id }
    });
    if (!application) throw notFound("Заявка не найдена");
    await sendTestTaskFile(res, application.testTaskFileUrl, application.testTaskFileName);
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
  "/applications/:applicationId/test-task-review",
  asyncHandler(async (req, res) => {
    const body = asObject(req.body);
    const status = stringField(body, "status").toUpperCase();
    const comment = nullableText(body, "comment");
    if (!Object.values(ReportReviewStatus).includes(status as ReportReviewStatus)) {
      throw badRequest(`Недопустимый статус проверки: ${status}`);
    }
    if (status === ReportReviewStatus.CHANGES_REQUESTED && !comment) {
      throw badRequest("Укажите, что нужно исправить в ответе");
    }

    const application = await prisma.application.findUnique({
      where: { id: req.params.applicationId },
      include: { cohort: { include: { testTask: true } } }
    });
    if (!application) throw notFound("Заявка не найдена");
    if (!application.testTaskSubmittedAt) throw badRequest("Ответ на тестовое задание ещё не отправлен");

    const updated = await prisma.application.update({
      where: { id: application.id },
      data: {
        testTaskReviewStatus: status as ReportReviewStatus,
        testTaskReviewComment: status === ReportReviewStatus.CHANGES_REQUESTED ? comment : null
      },
      include: {
        user: { select: { id: true, email: true, createdAt: true } },
        role: true
      }
    });
    await createUserNotification(application.userId, {
      type: "TEST_TASK",
      section: "APPLICATIONS",
      title: status === ReportReviewStatus.APPROVED
        ? "Ответ на тестовое задание одобрен"
        : status === ReportReviewStatus.CHANGES_REQUESTED
          ? "Ответ на тестовое задание требует исправлений"
          : "Ответ на тестовое задание проверяется",
      message: status === ReportReviewStatus.CHANGES_REQUESTED && comment
        ? `${application.cohort.name}: ${comment}`
        : `Когорта «${application.cohort.name}».`
    }).catch(() => undefined);
    res.json({ application: updated });
  })
);

adminApplicationsRouter.get(
  "/applications/:applicationId/test-task-file",
  asyncHandler(async (req, res) => {
    const application = await prisma.application.findUnique({
      where: { id: req.params.applicationId }
    });
    if (!application) throw notFound("Заявка не найдена");
    await sendTestTaskFile(res, application.testTaskFileUrl, application.testTaskFileName);
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
      where: { id: req.params.applicationId },
      include: { cohort: { include: { testTask: true } } }
    });

    if (!application) {
      throw notFound("Заявка не найдена");
    }

    assertApplicationDecision(status as ApplicationStatus, roleId, reviewComment);
    if (
      status === ApplicationStatus.APPROVED
      && application.cohort.testTask?.publishedAt
      && application.testTaskReviewStatus !== ReportReviewStatus.APPROVED
    ) {
      throw badRequest("Сначала одобрите ответ на тестовое задание");
    }

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

async function findEditableTestTaskApplication(applicationId: string, userId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: { cohort: { include: { testTask: true } } }
  });
  if (!application) throw notFound("Заявка не найдена");
  assertPracticeOpen(application.cohort);
  if (application.status === ApplicationStatus.REJECTED || application.status === ApplicationStatus.REMOVED) {
    throw badRequest("Нельзя отправить ответ по отклонённой заявке или после исключения из когорты");
  }
  if (application.testTaskReviewStatus === ReportReviewStatus.APPROVED) {
    throw badRequest("Ответ уже одобрен и больше недоступен для редактирования");
  }
  if (!application.cohort.testTask?.publishedAt) {
    throw badRequest("Тестовое задание ещё не опубликовано");
  }
  return application;
}

function nullableText(body: Record<string, unknown>, name: string) {
  const value = body[name];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw badRequest(`Поле «${name}» должно содержать текст`);
  return value.trim() || null;
}

function assertSafeArtifactLink(value: string | null) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw badRequest("Ссылка на результат должна начинаться с http:// или https://");
  }
}

function decodeUploadFilename(filename: string) {
  const decoded = Buffer.from(filename, "latin1").toString("utf8");
  return decoded.includes("\uFFFD") ? filename : decoded;
}

async function sendTestTaskFile(
  res: Parameters<Parameters<typeof asyncHandler>[0]>[1],
  fileUrl: string | null,
  fileName: string | null
) {
  if (!fileUrl) throw notFound("Файл ответа не загружен");
  const filePath = resolveTestTaskFile(fileUrl);
  await access(filePath).catch(() => {
    throw notFound("Файл ответа не найден");
  });
  res.download(filePath, fileName ?? "test-task-answer");
}

function resolveTestTaskFile(fileUrl: string) {
  const uploadsRoot = path.resolve(env.uploadsDir);
  const filePath = path.resolve(uploadsRoot, fileUrl);
  if (!filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw forbidden("Некорректный путь к файлу ответа");
  }
  return filePath;
}

async function removeTestTaskFile(fileUrl: string) {
  await unlink(resolveTestTaskFile(fileUrl)).catch(() => undefined);
}

async function notifyAdminsAboutTestTask(cohortName: string, studentEmail: string) {
  return createAdminNotifications({
    type: "TEST_TASK",
    section: "APPLICATIONS",
    title: "Получен ответ на тестовое задание",
    message: `${studentEmail} отправил ответ для когорты «${cohortName}».`
  });
}

