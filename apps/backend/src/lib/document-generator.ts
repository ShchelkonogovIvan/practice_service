import { readFileSync } from "node:fs";
import path from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { env } from "../config/env.js";

export type PracticeDocumentKind = "individual-assignment" | "review" | "title-page";

type DocumentData = Record<string, string>;

const templateFiles: Record<PracticeDocumentKind, string> = {
  "individual-assignment": "individual-task.docx",
  review: "review.docx",
  "title-page": "title-page.docx"
};

export function generatePracticeDocument(kind: PracticeDocumentKind, data: DocumentData) {
  const template = readFileSync(path.join(env.templatesDir, templateFiles[kind]));
  const document = new Docxtemplater(new PizZip(template), {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true
  });

  document.render(data);
  return document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}
