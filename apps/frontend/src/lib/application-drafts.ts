const APPLICATION_DRAFTS_KEY = "practice_application_drafts";

export function getApplicationDraft(cohortId: string): Record<string, string> {
  if (typeof window === "undefined") return {};

  try {
    const value = JSON.parse(window.localStorage.getItem(APPLICATION_DRAFTS_KEY) ?? "{}") as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const draft = (value as Record<string, unknown>)[cohortId];
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) return {};
    return Object.fromEntries(
      Object.entries(draft).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
  } catch {
    return {};
  }
}

export function saveApplicationDraft(cohortId: string, answers: Record<string, string>) {
  let drafts: Record<string, Record<string, string>> = {};
  try {
    const current = JSON.parse(window.localStorage.getItem(APPLICATION_DRAFTS_KEY) ?? "{}") as unknown;
    if (current && typeof current === "object" && !Array.isArray(current)) {
      drafts = current as Record<string, Record<string, string>>;
    }
  } catch {
    drafts = {};
  }
  window.localStorage.setItem(APPLICATION_DRAFTS_KEY, JSON.stringify({ ...drafts, [cohortId]: answers }));
}

export function clearApplicationDraft(cohortId: string) {
  try {
    const current = JSON.parse(window.localStorage.getItem(APPLICATION_DRAFTS_KEY) ?? "{}") as Record<string, unknown>;
    delete current[cohortId];
    window.localStorage.setItem(APPLICATION_DRAFTS_KEY, JSON.stringify(current));
  } catch {
    window.localStorage.removeItem(APPLICATION_DRAFTS_KEY);
  }
}
