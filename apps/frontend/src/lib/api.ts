const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const TOKEN_KEY = "practice_token";

export type AuthUser = {
  id: string;
  email: string;
  role: "STUDENT" | "ADMIN";
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
  return api<{ cohort: null | { id: string; name: string; surveyFields: Array<{ id: string; label: string; type: string }> } }>(
    "/public/cohorts/active"
  );
}

