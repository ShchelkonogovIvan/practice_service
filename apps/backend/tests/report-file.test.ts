import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import PizZip from "pizzip";
import { HttpError } from "../src/http/errors.js";
import { assertValidReportFile } from "../src/lib/report-file.js";

test("report validation accepts PDF content and rejects a renamed text file", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "practice-report-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const validPath = path.join(directory, "valid.pdf");
  const invalidPath = path.join(directory, "invalid.pdf");
  await writeFile(validPath, "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");
  await writeFile(invalidPath, "this is not a PDF");

  await assert.doesNotReject(() => assertValidReportFile(validPath, "report.pdf"));
  await assert.rejects(() => assertValidReportFile(invalidPath, "report.pdf"), isBadRequest);
});

test("report validation checks required DOCX archive entries", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "practice-report-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const validPath = path.join(directory, "valid.docx");
  const invalidPath = path.join(directory, "invalid.docx");
  const validZip = new PizZip();
  validZip.file("[Content_Types].xml", "<Types />");
  validZip.file("word/document.xml", "<document />");
  await writeFile(validPath, validZip.generate({ type: "nodebuffer" }));
  await writeFile(invalidPath, new PizZip().file("readme.txt", "not a document").generate({ type: "nodebuffer" }));

  await assert.doesNotReject(() => assertValidReportFile(validPath, "report.docx"));
  await assert.rejects(() => assertValidReportFile(invalidPath, "report.docx"), isBadRequest);
});

function isBadRequest(error: unknown) {
  return error instanceof HttpError && error.statusCode === 400;
}
