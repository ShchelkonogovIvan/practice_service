const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const TOKEN_KEY = "practice_token";
const PENDING_APPLICATION_KEY = "practice_pending_application";

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

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

export type StudentDocumentData = {
  id: string;
  userId: string;
  cohortId: string;
  studentFio: string | null;
  group: string | null;
  directionCode: string | null;
  directionName: string | null;
  programName: string | null;
  specialty: string | null;
  practiceTopic: string | null;
  mainStageTasks: string | null;
  supervisorUrfuName: string | null;
  reviewActivities: string | null;
  reviewCharacteristic: string | null;
  reviewEmployed: string | null;
  reviewNextPractice: string | null;
  reviewEmploymentOffer: string | null;
  reviewSuggestions: string | null;
  reviewGrade: string | null;
  reportFileUrl: string | null;
  reportFileName: string | null;
  reportUploadedAt: string | null;
  reportReviewStatus: ReportReviewStatus | null;
  reportReviewComment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportReviewStatus = "PENDING" | "APPROVED" | "CHANGES_REQUESTED";

export type DocumentReadiness = {
  individualReady: boolean;
  reviewReady: boolean;
  titleReady: boolean;
  reportUploaded: boolean;
  reportApproved: boolean;
  individualReason: string | null;
  reviewReason: string | null;
  titleReason: string | null;
};

export type AdminDocumentRow = {
  applicationId: string;
  user: { id: string; email: string };
  role: null | { id: string; name: string };
  data: StudentDocumentData | null;
  readiness: DocumentReadiness;
};

export type TaskCard = {
  id: string;
  userId: string;
  cohortId: string;
  date: string;
  title: string;
  description: string | null;
  doneText: string | null;
  artifactLink: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskParticipant = {
  userId: string;
  displayName: string;
  role: null | { id: string; name: string };
  cards: TaskCard[];
};

export type TaskBoard = {
  cohort: {
    id: string;
    name: string;
    practiceStart: string;
    practiceEnd: string;
  };
  participants: TaskParticipant[];
};

export type TaskCardValues = {
  title: string;
  description: string;
  doneText: string;
  artifactLink: string;
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
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(!isFormData ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new ApiError("Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз");
  }

  const data = await response.json().catch(() => ({})) as { message?: unknown };
  if (!response.ok) {
    const message = typeof data.message === "string" ? data.message : "";
    throw new ApiError(russianApiErrorMessage(message, response.status), response.status);
  }
  return data as T;
}

function russianApiErrorMessage(message: string, status: number) {
  if (/[А-Яа-яЁё]/.test(message)) {
    return message;
  }

  const exactTranslations: Record<string, string> = {
    Unauthorized: "Требуется авторизация",
    Forbidden: "Недостаточно прав для выполнения действия",
    "Not found": "Запрашиваемый ресурс не найден",
    "Internal server error": "Внутренняя ошибка сервера. Попробуйте ещё раз позже",
    "Request failed": "Не удалось выполнить запрос",
    "Failed to fetch": "Не удалось связаться с сервером"
  };

  if (exactTranslations[message]) {
    return exactTranslations[message];
  }

  const statusMessages: Record<number, string> = {
    400: "Проверьте введённые данные",
    401: "Требуется авторизация",
    403: "Недостаточно прав для выполнения действия",
    404: "Запрашиваемый ресурс не найден",
    409: "Такая запись уже существует",
    413: "Загружаемый файл слишком большой",
    429: "Слишком много запросов. Попробуйте ещё раз позже",
    500: "Внутренняя ошибка сервера. Попробуйте ещё раз позже",
    502: "Сервер временно недоступен",
    503: "Сервис временно недоступен"
  };

  return statusMessages[status] ?? "Не удалось выполнить запрос. Попробуйте ещё раз";
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

export async function publicCohort(cohortId: string) {
  return api<{ cohort: Cohort }>(`/public/cohorts/${cohortId}`);
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

export async function myDocumentData(cohortId: string) {
  return api<{ data: StudentDocumentData | null; readiness: DocumentReadiness }>(
    `/cohorts/${cohortId}/documents/me`
  );
}

export async function saveMyDocumentData(
  cohortId: string,
  values: Partial<Pick<StudentDocumentData,
    | "studentFio"
    | "group"
    | "directionCode"
    | "directionName"
    | "programName"
    | "specialty"
    | "practiceTopic"
    | "mainStageTasks"
  >>
) {
  return api<{ data: StudentDocumentData; readiness: DocumentReadiness }>(
    `/cohorts/${cohortId}/documents/me`,
    { method: "PUT", body: JSON.stringify(values) }
  );
}

export async function uploadPracticeReport(cohortId: string, file: File) {
  const form = new FormData();
  form.append("report", file);
  return api<{ data: StudentDocumentData; readiness: DocumentReadiness }>(
    `/cohorts/${cohortId}/documents/me/report`,
    { method: "POST", body: form }
  );
}

export async function listAdminDocuments(cohortId: string) {
  return api<{ rows: AdminDocumentRow[] }>(`/admin/cohorts/${cohortId}/documents`);
}

export async function saveAdminReview(
  cohortId: string,
  userId: string,
  values: Pick<StudentDocumentData,
    | "reviewActivities"
    | "reviewCharacteristic"
    | "reviewEmployed"
    | "reviewNextPractice"
    | "reviewEmploymentOffer"
    | "reviewSuggestions"
    | "reviewGrade"
  >
) {
  return api<{ data: StudentDocumentData; readiness: DocumentReadiness }>(
    `/admin/cohorts/${cohortId}/documents/${userId}/review`,
    { method: "PUT", body: JSON.stringify(values) }
  );
}

export async function setReportReview(
  cohortId: string,
  userId: string,
  status: ReportReviewStatus,
  comment: string
) {
  return api<{ data: StudentDocumentData; readiness: DocumentReadiness }>(
    `/admin/cohorts/${cohortId}/documents/${userId}/report-review`,
    { method: "PATCH", body: JSON.stringify({ status, comment }) }
  );
}

export async function getTaskBoard(cohortId: string, showAll: boolean) {
  const query = showAll ? "?showAll=true" : "";
  return api<TaskBoard>(`/cohorts/${cohortId}/tasks${query}`);
}

export async function createTaskCard(cohortId: string, date: string, values: TaskCardValues) {
  return api<{ card: TaskCard }>(`/cohorts/${cohortId}/tasks`, {
    method: "POST",
    body: JSON.stringify({ date, ...values })
  });
}

export async function updateTaskCard(taskId: string, values: TaskCardValues) {
  return api<{ card: TaskCard }>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(values)
  });
}

export async function downloadApiFile(path: string, fallbackName: string) {
  const token = getToken();
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
  } catch {
    throw new ApiError("Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { message?: unknown };
    const message = typeof data.message === "string" ? data.message : "";
    throw new ApiError(
      message ? russianApiErrorMessage(message, response.status) : "Не удалось скачать файл",
      response.status
    );
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const encodedFilename = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const filename = encodedFilename
    ? decodeURIComponent(encodedFilename)
    : contentDisposition.match(/filename="?([^";]+)"?/i)?.[1] ?? fallbackName;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

