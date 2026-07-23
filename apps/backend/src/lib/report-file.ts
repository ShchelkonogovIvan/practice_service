import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { badRequest } from "../http/errors.js";

export async function assertValidReportFile(filePath: string, originalName: string, subject = "отчёта") {
  const extension = path.extname(originalName).toLowerCase();
  const content = await readFile(filePath);

  if (extension === ".pdf") {
    const tail = content.subarray(Math.max(0, content.length - 1024)).toString("ascii");
    if (content.subarray(0, 5).toString("ascii") !== "%PDF-" || !tail.includes("%%EOF")) {
      throw badRequest(`Файл ${subject} не является корректным PDF`);
    }
    return;
  }

  if (extension === ".docx") {
    try {
      const zip = new PizZip(content);
      if (!zip.file("[Content_Types].xml") || !zip.file("word/document.xml")) {
        throw new Error("Missing DOCX entries");
      }
      return;
    } catch {
      throw badRequest(`Файл ${subject} не является корректным DOCX`);
    }
  }

  throw badRequest(`Допустимые форматы файла ${subject}: docx, pdf`);
}
