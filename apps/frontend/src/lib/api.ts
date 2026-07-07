const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const TOKEN_KEY = "practice_token";

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
  return api<{ applications: Array<{ id: string; status: string; cohort: { name: string } }> }>(
    "/me/applications"
  );
}

export async function activeCohort() {
  return api<{ cohort: null | Cohort }>("/public/cohorts/active");
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

