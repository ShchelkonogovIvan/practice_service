import assert from "node:assert/strict";
import test from "node:test";
import { formatShortFio } from "../src/lib/document-names.js";

test("formats a full Russian name for title pages and reviews", () => {
  assert.equal(formatShortFio("Щелконогов Иван Сергеевич"), "Щелконогов И.С.");
  assert.equal(formatShortFio("  Щелконогов   Иван  "), "Щелконогов И.");
});

test("keeps incomplete names readable", () => {
  assert.equal(formatShortFio("Щелконогов"), "Щелконогов");
  assert.equal(formatShortFio(null), "");
});
