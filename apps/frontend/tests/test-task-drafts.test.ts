import assert from "node:assert/strict";
import test from "node:test";
import { clearTestTaskDraft, getTestTaskDraft, saveTestTaskDraft } from "../src/lib/test-task-drafts.ts";

test("test task drafts are isolated by application", () => {
  const storage = createStorage();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });

  try {
    saveTestTaskDraft("application-1", { answer: "Первый ответ", artifactLink: "https://example.com/1" });
    saveTestTaskDraft("application-2", { answer: "Второй ответ", artifactLink: "" });
    assert.deepEqual(getTestTaskDraft("application-1"), {
      answer: "Первый ответ",
      artifactLink: "https://example.com/1"
    });
    assert.equal(getTestTaskDraft("application-2").answer, "Второй ответ");

    clearTestTaskDraft("application-1");
    assert.deepEqual(getTestTaskDraft("application-1"), { answer: "", artifactLink: "" });
    assert.equal(getTestTaskDraft("application-2").answer, "Второй ответ");
  } finally {
    Reflect.deleteProperty(globalThis, "window");
  }
});

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    }
  };
}
