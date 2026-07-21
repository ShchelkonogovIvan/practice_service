export const writableStudentFields = [
  "studentFio",
  "studentFioGenitive",
  "group",
  "directionCode",
  "directionName",
  "programName",
  "specialty",
  "practiceTopic",
  "mainStageTasks",
  "supervisorUrfuName"
] as const;

export const writableReviewFields = [
  "reviewActivities",
  "reviewCharacteristic",
  "reviewEmployed",
  "reviewNextPractice",
  "reviewEmploymentOffer",
  "reviewSuggestions",
  "reviewGrade"
] as const;

const individualFields = [
  "studentFioGenitive",
  "group",
  "directionCode",
  "directionName",
  "programName",
  "practiceTopic",
  "mainStageTasks",
  "supervisorUrfuName"
] as const;

const titleFields = ["studentFio", "group", "specialty", "practiceTopic"] as const;
const reviewStudentFields = ["studentFio", "group"] as const;

export function documentReadiness(data: Record<string, unknown> | null) {
  const individualReady = hasFields(data, individualFields);
  const reviewReady = hasFields(data, reviewStudentFields) && hasFields(data, writableReviewFields);
  const reportUploaded = Boolean(data?.reportFileUrl);
  const reportApproved = data?.reportReviewStatus === "APPROVED";
  const titleReady = hasFields(data, titleFields) && reportUploaded && reportApproved;

  return {
    individualReady,
    reviewReady,
    titleReady,
    reportUploaded,
    reportApproved,
    individualReason: individualReady ? null : missingFieldsReason(data, individualFields),
    reviewReason: reviewReady
      ? null
      : hasFields(data, reviewStudentFields)
        ? "Отзыв ещё не заполнен администратором"
        : missingFieldsReason(data, reviewStudentFields),
    titleReason: titleReady
      ? null
      : !hasFields(data, titleFields)
        ? missingFieldsReason(data, titleFields)
        : !reportUploaded
          ? "Сначала загрузите отчёт о практике"
          : "Администратор ещё не проверил отчёт"
  };
}

function hasFields(data: Record<string, unknown> | null, fields: readonly string[]) {
  return Boolean(data && fields.every((field) => typeof data[field] === "string" && data[field].trim().length > 0));
}

const fieldLabels: Record<string, string> = {
  studentFio: "ФИО",
  studentFioGenitive: "ФИО в родительном падеже",
  group: "группа",
  directionCode: "код направления",
  directionName: "наименование направления",
  programName: "образовательная программа",
  specialty: "специальность",
  practiceTopic: "тема практики",
  mainStageTasks: "работы основного этапа",
  supervisorUrfuName: "руководитель практики от УрФУ"
};

function missingFieldsReason(data: Record<string, unknown> | null, fields: readonly string[]) {
  const missing = fields
    .filter((field) => typeof data?.[field] !== "string" || !data[field].trim())
    .map((field) => fieldLabels[field] ?? field);
  return `Заполните: ${missing.join(", ")}`;
}
