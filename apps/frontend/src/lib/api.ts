const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const TOKEN_KEY = "practice_token";
const PENDING_APPLICATION_KEY = "practice_pending_application";

export type AuthUser = {
  id: string;
  email: string;
  role: "STUDENT" | "ADMIN";
};

export type Cohort = {
  id: string;
  name: string;
  applicationStart: string;
  applicationEnd: string;
  practiceStart: string;
  practiceEnd: string;
  surveyFields: Array<{
    id: string;
    label: string;
    type: "TEXT" | "TEXTAREA" | "SELECT";
    options?: unknown;
    required: boolean;
  }>;
  roles: Array<{ id: string; name: string }>;
  testTask: null | {
    id: string;
    content: string;
    publishedAt: string | null;
  };
};

export type Application = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  answers: Record<string, unknown>;
  reviewComment: string | null;
  createdAt: string;
  updatedAt: string;
  role: null | { id: string; name: string };
  cohort: Cohort;
};

export type AdminApplication = Omit<Application, "cohort"> & {
  user: {
    id: string;
    email: string;
    createdAt?: string;
  };
};

export function getToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message ?? "Request failed");
  }
  return data as T;
}

export async function login(email: string, password: string) {
  return api<{ user: AuthUser; token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function register(email: string, password: string) {
  return api<{ user: AuthUser; token: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function currentUser() {
  return api<{ user: AuthUser }>("/auth/me");
}

export async function myApplications() {
  return api<{ applications: Application[] }>("/me/applications");
}

export async function activeCohort() {
  return api<{ cohort: null | Cohort; cohorts: Cohort[] }>("/public/cohorts/active");
}

export async function listCohorts() {
  return api<{ cohorts: Cohort[] }>("/cohorts");
}

export async function createCohort(payload: {
  name: string;
  applicationStart: string;
  applicationEnd: string;
  practiceStart: string;
  practiceEnd: string;
  surveyFields: Array<{
    label: string;
    type: "TEXT" | "TEXTAREA" | "SELECT";
    options?: string[];
    required: boolean;
  }>;
  roles: string[];
  testTaskContent?: string;
  testTaskPublished?: boolean;
}) {
  return api<{ cohort: Cohort }>("/cohorts", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateCohortSurvey(
  cohortId: string,
  surveyFields: Array<{
    label: string;
    type: "TEXT" | "TEXTAREA" | "SELECT";
    options?: string[];
    required: boolean;
  }>
) {
  return api<{ cohort: Cohort }>(`/cohorts/${cohortId}/survey-fields`, {
    method: "PUT",
    body: JSON.stringify({ surveyFields })
  });
}

export async function updateCohortRoles(cohortId: string, roles: string[]) {
  return api<{ cohort: Cohort; warning: string | null }>(`/cohorts/${cohortId}/roles`, {
    method: "PUT",
    body: JSON.stringify({ roles })
  });
}

export async function updateTestTask(cohortId: string, content: string, published: boolean) {
  return api<{ testTask: Cohort["testTask"] }>(`/cohorts/${cohortId}/test-task`, {
    method: "PUT",
    body: JSON.stringify({ content, published })
  });
}

export async function listCohortApplications(cohortId: string) {
  return api<{ applications: AdminApplication[] }>(`/admin/cohorts/${cohortId}/applications`);
}

export async function updateApplicationStatus(payload: {
  applicationId: string;
  status: Application["status"];
  roleId?: string;
  reviewComment?: string;
}) {
  return api<{ application: AdminApplication }>(`/admin/applications/${payload.applicationId}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status: payload.status,
      roleId: payload.roleId,
      reviewComment: payload.reviewComment
    })
  });
}

export async function submitApplication(cohortId: string, answers: Record<string, unknown> = {}) {
  return api<{ application: Application }>(`/cohorts/${cohortId}/applications`, {
    method: "POST",
    body: JSON.stringify({ answers })
  });
}

export type PendingApplication = {
  cohortId: string;
  answers: Record<string, string>;
};

export function savePendingApplication(application: PendingApplication) {
  window.localStorage.setItem(PENDING_APPLICATION_KEY, JSON.stringify(application));
}

export function getPendingApplication() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(PENDING_APPLICATION_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as PendingApplication;
    if (!parsed.cohortId || !parsed.answers || typeof parsed.answers !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingApplication() {
  window.localStorage.removeItem(PENDING_APPLICATION_KEY);
}

