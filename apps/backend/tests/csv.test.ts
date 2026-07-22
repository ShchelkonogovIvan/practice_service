import assert from "node:assert/strict";
import test from "node:test";
import { toCsv } from "../src/lib/csv.js";

test("CSV uses UTF-8 BOM, semicolons and escapes quotes and line breaks", () => {
  const csv = toCsv(["Имя", "Комментарий"], [["Иван", "Строка 1\n\"Строка 2\""]]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"Имя";"Комментарий"/);
  assert.match(csv, /"Строка 1\n""Строка 2"""/);
  assert.ok(csv.endsWith("\r\n"));
});

test("CSV neutralizes spreadsheet formulas from user input", () => {
  const csv = toCsv(["Ответ"], [["=HYPERLINK(\"https://example.com\")"], ["+1+1"], ["@SUM(A1:A2)"]]);
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /"'\+1\+1"/);
  assert.match(csv, /"'@SUM/);
});
