import assert from "node:assert/strict";
import test from "node:test";
import { clearApplicationDraft, getApplicationDraft, saveApplicationDraft } from "../src/lib/application-drafts.ts";

test("application drafts are stored independently for each cohort", () => {
  const storage = createStorage();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });

  try {
    saveApplicationDraft("cohort-1", { fio: "Иван Иванов", group: "РИ-13003" });
    saveApplicationDraft("cohort-2", { fio: "Пётр Петров" });

    assert.deepEqual(getApplicationDraft("cohort-1"), { fio: "Иван Иванов", group: "РИ-13003" });
    assert.deepEqual(getApplicationDraft("cohort-2"), { fio: "Пётр Петров" });

    clearApplicationDraft("cohort-1");
    assert.deepEqual(getApplicationDraft("cohort-1"), {});
    assert.deepEqual(getApplicationDraft("cohort-2"), { fio: "Пётр Петров" });
  } finally {
    Reflect.deleteProperty(globalThis, "window");
  }
});

test("invalid draft storage is ignored and replaced on save", () => {
  const storage = createStorage();
  storage.setItem("practice_application_drafts", "not-json");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });

  try {
    assert.deepEqual(getApplicationDraft("cohort-1"), {});
    saveApplicationDraft("cohort-1", { track: "Backend" });
    assert.deepEqual(getApplicationDraft("cohort-1"), { track: "Backend" });
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
