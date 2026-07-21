import type { AdminApplication, AdminDocumentRow, Application, StudentDocumentData, TaskBoard } from "./api";

export type ReportFilter = "ALL" | "NOT_UPLOADED" | "PENDING" | "APPROVED" | "CHANGES_REQUESTED";

export type AdminOverviewData = {
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  participants: number;
  completeDocumentProfiles: number;
  reportsUploaded: number;
  reportsToReview: number;
  reportsForRevision: number;
  reportsApproved: number;
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
};

export function buildAdminOverview(
  applications: AdminApplication[],
  documents: AdminDocumentRow[],
  taskBoard: TaskBoard
): AdminOverviewData {
  const taskCards = taskBoard.participants.flatMap((participant) => participant.cards);

  return {
    totalApplications: applications.length,
    pendingApplications: applications.filter((application) => application.status === "PENDING").length,
    approvedApplications: applications.filter((application) => application.status === "APPROVED").length,
    rejectedApplications: applications.filter((application) => application.status === "REJECTED").length,
    participants: documents.length,
    completeDocumentProfiles: documents.filter((row) => {
      const readiness = studentDocumentFieldsReadiness(row.data);
      return readiness.individual && readiness.review && readiness.title;
    }).length,
    reportsUploaded: documents.filter((row) => row.readiness.reportUploaded).length,
    reportsToReview: documents.filter((row) =>
      row.readiness.reportUploaded && (!row.data?.reportReviewStatus || row.data.reportReviewStatus === "PENDING")
    ).length,
    reportsForRevision: documents.filter((row) => row.data?.reportReviewStatus === "CHANGES_REQUESTED").length,
    reportsApproved: documents.filter((row) => row.data?.reportReviewStatus === "APPROVED").length,
    totalTasks: taskCards.length,
    completedTasks: taskCards.filter((card) => Boolean(card.doneText?.trim())).length,
    incompleteTasks: taskCards.filter((card) => !card.doneText?.trim()).length
  };
}

export function studentDocumentFieldsReadiness(data: StudentDocumentData | null) {
  const filled = (value: string | null | undefined) => Boolean(value?.trim());
  return {
    individual: Boolean(data && [data.studentFioGenitive, data.group, data.directionCode, data.directionName, data.programName, data.practiceTopic, data.mainStageTasks, data.supervisorUrfuName].every(filled)),
    review: Boolean(data && [data.studentFio, data.group].every(filled)),
    title: Boolean(data && [data.studentFio, data.group, data.specialty, data.practiceTopic].every(filled))
  };
}

export function filterAdminApplications(
  applications: AdminApplication[],
  status: "ALL" | Application["status"],
  query: string
) {
  const normalizedQuery = normalizeQuery(query);
  return applications.filter((application) => {
    if (status !== "ALL" && application.status !== status) return false;
    if (!normalizedQuery) return true;

    return searchableText([
      application.user.email,
      application.role?.name,
      ...Object.values(application.answers)
    ]).includes(normalizedQuery);
  });
}

export function filterAdminDocumentRows(rows: AdminDocumentRow[], filter: ReportFilter, query: string) {
  const normalizedQuery = normalizeQuery(query);
  return rows.filter((row) => {
    if (!matchesReportFilter(row, filter)) return false;
    if (!normalizedQuery) return true;

    return searchableText([
      row.data?.studentFio,
      row.data?.group,
      row.user.email,
      row.role?.name
    ]).includes(normalizedQuery);
  });
}

function matchesReportFilter(row: AdminDocumentRow, filter: ReportFilter) {
  if (filter === "ALL") return true;
  if (filter === "NOT_UPLOADED") return !row.readiness.reportUploaded;
  if (!row.readiness.reportUploaded) return false;
  return (row.data?.reportReviewStatus ?? "PENDING") === filter;
}

function searchableText(values: unknown[]) {
  return values.map(searchValue).filter(Boolean).join(" ").toLocaleLowerCase("ru-RU");
}

function searchValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(searchValue).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(searchValue).join(" ");
  return value === null || value === undefined ? "" : String(value);
}

function normalizeQuery(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}
