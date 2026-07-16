import assert from "node:assert/strict";
import { readdir, unlink } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";
import test from "node:test";
import { ApplicationStatus, UserRole } from "@prisma/client";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { signAccessToken } from "../../src/lib/jwt.js";
import { prisma } from "../../src/lib/prisma.js";

test("API enforces cohort access, file validation and report review workflow", async (context) => {
  process.env.NODE_ENV = "test";
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

  const admin = await prisma.user.create({ data: { email: `admin-${suffix}@example.com`, passwordHash: "test", role: UserRole.ADMIN } });
  const owner = await prisma.user.create({ data: { email: `owner-${suffix}@example.com`, passwordHash: "test" } });
  const other = await prisma.user.create({ data: { email: `other-${suffix}@example.com`, passwordHash: "test" } });
  const pending = await prisma.user.create({ data: { email: `pending-${suffix}@example.com`, passwordHash: "test" } });
  const cohort = await prisma.cohort.create({
    data: {
      name: `Integration ${suffix}`,
      applicationStart: new Date("2026-01-01T00:00:00.000Z"),
      applicationEnd: new Date("2026-01-31T00:00:00.000Z"),
      practiceStart: new Date("2026-02-02T00:00:00.000Z"),
      practiceEnd: new Date("2026-02-27T00:00:00.000Z")
    }
  });
  const role = await prisma.cohortRole.create({ data: { cohortId: cohort.id, name: "Backend" } });
  const ownerApplication = await prisma.application.create({ data: { userId: owner.id, cohortId: cohort.id, roleId: role.id, status: ApplicationStatus.APPROVED } });
  await prisma.application.create({ data: { userId: other.id, cohortId: cohort.id, roleId: role.id, status: ApplicationStatus.APPROVED } });
  await prisma.application.create({ data: { userId: pending.id, cohortId: cohort.id, status: ApplicationStatus.PENDING } });
  const card = await prisma.taskCard.create({ data: { userId: owner.id, cohortId: cohort.id, date: new Date("2026-02-02T00:00:00.000Z"), title: "Owner task" } });

  const tokens = {
    admin: signAccessToken({ sub: admin.id, role: "ADMIN" }),
    owner: signAccessToken({ sub: owner.id, role: "STUDENT" }),
    other: signAccessToken({ sub: other.id, role: "STUDENT" }),
    pending: signAccessToken({ sub: pending.id, role: "STUDENT" })
  };
  let uploadedPath: string | null = null;

  context.after(async () => {
    server.close();
    if (uploadedPath) await unlink(uploadedPath).catch(() => undefined);
    await prisma.cohort.delete({ where: { id: cohort.id } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, owner.id, other.id, pending.id] } } });
  });

  assert.equal((await request(baseUrl, `/cohorts/${cohort.id}/documents/me`)).status, 401);
  assert.equal((await request(baseUrl, `/cohorts/${cohort.id}/documents/me`, tokens.pending)).status, 403);
  assert.equal((await request(baseUrl, `/admin/cohorts/${cohort.id}/documents`, tokens.owner)).status, 403);
  assert.equal((await request(baseUrl, `/tasks/${card.id}`, tokens.other, { method: "PATCH", body: JSON.stringify({ title: "Changed" }) })).status, 403);

  const firstPublication = await request(baseUrl, `/cohorts/${cohort.id}/test-task`, tokens.admin, {
    method: "PUT",
    body: JSON.stringify({ content: "Test task", published: true })
  });
  assert.equal(firstPublication.status, 200);
  assert.deepEqual((await firstPublication.json() as { notification: { recipients: number; sent: number } }).notification, { recipients: 3, sent: 0 });
  const repeatedPublication = await request(baseUrl, `/cohorts/${cohort.id}/test-task`, tokens.admin, {
    method: "PUT",
    body: JSON.stringify({ content: "Updated test task", published: true })
  });
  assert.equal(repeatedPublication.status, 200);
  assert.equal((await repeatedPublication.json() as { notification: null }).notification, null);

  const reportsDirectory = path.resolve(env.uploadsDir, "reports");
  const filesBeforeInvalidUpload = await readdir(reportsDirectory).catch(() => [] as string[]);
  const invalidForm = new FormData();
  invalidForm.append("report", new Blob(["plain text"], { type: "application/pdf" }), "report.pdf");
  const invalidUpload = await request(baseUrl, `/cohorts/${cohort.id}/documents/me/report`, tokens.owner, { method: "POST", body: invalidForm });
  assert.equal(invalidUpload.status, 400);
  assert.equal(await prisma.studentDocumentData.count({ where: { userId: owner.id, cohortId: cohort.id, reportFileUrl: { not: null } } }), 0);
  assert.deepEqual(await readdir(reportsDirectory).catch(() => [] as string[]), filesBeforeInvalidUpload);

  const validForm = new FormData();
  validForm.append("report", new Blob(["%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"], { type: "application/pdf" }), "report.pdf");
  const validUpload = await request(baseUrl, `/cohorts/${cohort.id}/documents/me/report`, tokens.owner, { method: "POST", body: validForm });
  assert.equal(validUpload.status, 201);
  const uploaded = await validUpload.json() as { data: { reportFileUrl: string; reportReviewStatus: string } };
  assert.equal(uploaded.data.reportReviewStatus, "PENDING");
  uploadedPath = path.resolve(env.uploadsDir, uploaded.data.reportFileUrl);

  const missingComment = await request(baseUrl, `/admin/cohorts/${cohort.id}/documents/${owner.id}/report-review`, tokens.admin, {
    method: "PATCH",
    body: JSON.stringify({ status: "CHANGES_REQUESTED", comment: "" })
  });
  assert.equal(missingComment.status, 400);

  const changesRequested = await request(baseUrl, `/admin/cohorts/${cohort.id}/documents/${owner.id}/report-review`, tokens.admin, {
    method: "PATCH",
    body: JSON.stringify({ status: "CHANGES_REQUESTED", comment: "Добавьте заключение" })
  });
  assert.equal(changesRequested.status, 200);
  const review = await changesRequested.json() as { data: { reportReviewStatus: string; reportReviewComment: string } };
  assert.equal(review.data.reportReviewStatus, "CHANGES_REQUESTED");
  assert.equal(review.data.reportReviewComment, "Добавьте заключение");

  const approval = await request(baseUrl, `/admin/cohorts/${cohort.id}/documents/${owner.id}/report-review`, tokens.admin, {
    method: "PATCH",
    body: JSON.stringify({ status: "APPROVED" })
  });
  assert.equal(approval.status, 200);

  const revoked = await request(baseUrl, `/admin/cohorts/${cohort.id}/documents/${owner.id}/report-review`, tokens.admin, {
    method: "PATCH",
    body: JSON.stringify({ status: "PENDING" })
  });
  assert.equal(revoked.status, 200);
  assert.equal((await revoked.json() as { data: { reportReviewStatus: string } }).data.reportReviewStatus, "PENDING");

  const rejectionWithoutComment = await request(baseUrl, `/admin/applications/${ownerApplication.id}/status`, tokens.admin, {
    method: "PATCH",
    body: JSON.stringify({ status: "REJECTED" })
  });
  assert.equal(rejectionWithoutComment.status, 200);
});

async function request(baseUrl: string, route: string, token?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (typeof init.body === "string") headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${route}`, { ...init, headers });
}
