const TEST_TASK_DRAFTS_KEY = "practice_test_task_drafts";

export type TestTaskDraft = {
  answer: string;
  artifactLink: string;
};

const emptyDraft: TestTaskDraft = { answer: "", artifactLink: "" };

export function getTestTaskDraft(applicationId: string): TestTaskDraft {
  if (typeof window === "undefined") return emptyDraft;
  try {
    const value = JSON.parse(window.localStorage.getItem(TEST_TASK_DRAFTS_KEY) ?? "{}") as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return emptyDraft;
    const draft = (value as Record<string, unknown>)[applicationId];
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) return emptyDraft;
    const record = draft as Record<string, unknown>;
    return {
      answer: typeof record.answer === "string" ? record.answer : "",
      artifactLink: typeof record.artifactLink === "string" ? record.artifactLink : ""
    };
  } catch {
    return emptyDraft;
  }
}

export function saveTestTaskDraft(applicationId: string, draft: TestTaskDraft) {
  if (typeof window === "undefined") return;
  const drafts = readDrafts();
  window.localStorage.setItem(TEST_TASK_DRAFTS_KEY, JSON.stringify({ ...drafts, [applicationId]: draft }));
}

export function clearTestTaskDraft(applicationId: string) {
  if (typeof window === "undefined") return;
  const drafts = readDrafts();
  delete drafts[applicationId];
  if (Object.keys(drafts).length) {
    window.localStorage.setItem(TEST_TASK_DRAFTS_KEY, JSON.stringify(drafts));
  } else {
    window.localStorage.removeItem(TEST_TASK_DRAFTS_KEY);
  }
}

function readDrafts(): Record<string, TestTaskDraft> {
  try {
    const value = JSON.parse(window.localStorage.getItem(TEST_TASK_DRAFTS_KEY) ?? "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, TestTaskDraft>
      : {};
  } catch {
    return {};
  }
}
