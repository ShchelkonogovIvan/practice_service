"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import {
  Application,
  AuthUser,
  Cohort,
  activeCohort,
  clearToken,
  createCohort,
  currentUser,
  listCohorts,
  myApplications,
  submitApplication
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CohortForm = {
  name: string;
  applicationStart: string;
  applicationEnd: string;
  practiceStart: string;
  practiceEnd: string;
  surveyText: string;
  rolesText: string;
  testTaskContent: string;
  testTaskPublished: boolean;
};

type Answers = Record<string, string>;
type AnswersByCohort = Record<string, Answers>;

const initialForm: CohortForm = {
  name: "",
  applicationStart: "",
  applicationEnd: "",
  practiceStart: "",
  practiceEnd: "",
  surveyText: "ФИО\nГруппа\nЖелаемая роль | Frontend, Backend, Аналитик\nСтек технологий",
  rolesText: "Frontend\nBackend\nАналитик",
  testTaskContent: "",
  testTaskPublished: false
};

export function DashboardShell() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [activeCohorts, setActiveCohorts] = useState<Cohort[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [answersByCohort, setAnswersByCohort] = useState<AnswersByCohort>({});
  const [form, setForm] = useState<CohortForm>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [expandedCohortId, setExpandedCohortId] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN";
  const approvedApplication = applications.find((application) => application.status === "APPROVED");
  const editableCohorts = isAdmin
    ? []
    : activeCohorts.filter((item) => applicationForCohort(applications, item.id)?.status !== "APPROVED");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const [userResult, applicationResult, cohortResult] = await Promise.all([
        currentUser(),
        myApplications(),
        activeCohort()
      ]);

      setUser(userResult.user);
      setApplications(applicationResult.applications);
      setActiveCohorts(cohortResult.cohorts ?? (cohortResult.cohort ? [cohortResult.cohort] : []));
      setAnswersByCohort(buildInitialAnswersByCohort(cohortResult.cohorts ?? [], applicationResult.applications));

      if (userResult.user.role === "ADMIN") {
        const cohortList = await listCohorts();
        setCohorts(cohortList.cohorts);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Нужно войти заново");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearToken();
    router.push("/auth");
  }

  async function onCreateCohort(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await createCohort({
        name: form.name,
        applicationStart: form.applicationStart,
        applicationEnd: form.applicationEnd,
        practiceStart: form.practiceStart,
        practiceEnd: form.practiceEnd,
        surveyFields: parseSurveyText(form.surveyText),
        roles: parseLines(form.rolesText),
        testTaskContent: form.testTaskContent || undefined,
        testTaskPublished: form.testTaskPublished
      });

      setForm(initialForm);
      setMessage("Когорта создана");
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не получилось создать когорту");
    } finally {
      setSaving(false);
    }
  }

  async function onApplyToCohort(event: React.FormEvent, cohort: Cohort) {
    event.preventDefault();

    const answers = answersByCohort[cohort.id] ?? {};
    const activeApplication = applicationForCohort(applications, cohort.id);

    const missingField = cohort.surveyFields.find(
      (field) => field.required && !answers[field.id]?.trim()
    );

    if (missingField) {
      setError(`Заполните поле "${missingField.label}"`);
      return;
    }

    setApplying(true);
    setError(null);
    setMessage(null);

    try {
      await submitApplication(cohort.id, answers);
      setMessage(activeApplication ? "Заявка обновлена" : "Заявка отправлена");
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не получилось отправить заявку");
    } finally {
      setApplying(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Личный кабинет</p>
          <h1 className="text-2xl font-semibold tracking-tight">Практика</h1>
        </div>
        <Button variant="secondary" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Выйти
        </Button>
      </header>

      {error ? (
        <Card className="mb-4 border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </Card>
      ) : null}

      {message ? (
        <Card className="mb-4 border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-700">{message}</p>
        </Card>
      ) : null}

      {loading ? <Card className="p-5 text-sm text-muted">Загрузка...</Card> : null}

      {!loading && (
        <div className="grid gap-4">
          <ProfileCard user={user} />
          {!isAdmin ? <ActiveCohortCard application={approvedApplication} /> : null}
          {isAdmin ? (
            <AdminCohorts
              cohorts={cohorts}
              form={form}
              saving={saving}
              setForm={setForm}
              onCreateCohort={onCreateCohort}
            />
          ) : (
            <>
              <ApplicationFormCard
                cohorts={editableCohorts}
                applications={applications}
                answersByCohort={answersByCohort}
                applying={applying}
                expandedCohortId={expandedCohortId}
                onToggleCohort={(cohortId) =>
                  setExpandedCohortId((current) => (current === cohortId ? null : cohortId))
                }
                onAnswerChange={(cohortId, fieldId, value) =>
                  setAnswersByCohort((current) => ({
                    ...current,
                    [cohortId]: {
                      ...(current[cohortId] ?? {}),
                      [fieldId]: value
                    }
                  }))
                }
                onSubmit={onApplyToCohort}
              />
              <StudentApplications applications={applications} />
            </>
          )}
        </div>
      )}
    </main>
  );
}

function ProfileCard({ user }: { user: AuthUser | null }) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Профиль</h2>
      <p className="mt-2 text-sm text-muted">
        {user ? `${user.email} · ${user.role}` : "Неизвестный пользователь"}
      </p>
    </Card>
  );
}

function ActiveCohortCard({ application }: { application?: Application }) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Активная когорта</h2>
      <p className="mt-2 text-sm text-muted">
        {application
          ? application.cohort.name
          : "Активной когорты пока нет. Она появится после одобрения заявки."}
      </p>
    </Card>
  );
}

function ApplicationFormCard({
  cohorts,
  applications,
  answersByCohort,
  applying,
  expandedCohortId,
  onToggleCohort,
  onAnswerChange,
  onSubmit
}: {
  cohorts: Cohort[];
  applications: Application[];
  answersByCohort: AnswersByCohort;
  applying: boolean;
  expandedCohortId: string | null;
  onToggleCohort: (cohortId: string) => void;
  onAnswerChange: (cohortId: string, fieldId: string, value: string) => void;
  onSubmit: (event: React.FormEvent, cohort: Cohort) => void;
}) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Заявка на практику</h2>
      {cohorts.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          Сейчас нет доступных когорт для подачи заявки.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          {cohorts.map((cohort) => {
            const application = applicationForCohort(applications, cohort.id);
            const answers = answersByCohort[cohort.id] ?? {};
            const isExpanded = expandedCohortId === cohort.id;

            return (
              <form
                key={cohort.id}
                className="grid gap-4 rounded-md border border-border bg-white p-4"
                onSubmit={(event) => onSubmit(event, cohort)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{cohort.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      Прием заявок: {formatDate(cohort.applicationStart)} - {formatDate(cohort.applicationEnd)}
                    </p>
                    {application ? (
                      <p className="mt-2 text-sm text-muted">
                        Заявка уже есть, можно обновить ответы.
                      </p>
                    ) : null}
                  </div>
                  <Button type="button" variant="secondary" onClick={() => onToggleCohort(cohort.id)}>
                    {isExpanded ? "Свернуть" : application ? "Изменить" : "Заполнить"}
                  </Button>
                </div>

                {isExpanded ? (
                  <>
                    {cohort.surveyFields.length === 0 ? (
                      <p className="text-sm text-muted">У этой когорты пока нет полей анкеты.</p>
                    ) : (
                      cohort.surveyFields.map((field) => (
                        <SurveyFieldControl
                          key={field.id}
                          field={field}
                          value={answers[field.id] ?? ""}
                          onChange={(value) => onAnswerChange(cohort.id, field.id, value)}
                        />
                      ))
                    )}

                    {cohort.testTask?.publishedAt ? (
                      <div className="rounded-md border border-border bg-slate-50 p-4">
                        <p className="font-medium">Тестовое задание</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{cohort.testTask.content}</p>
                      </div>
                    ) : null}

                    <Button type="submit" disabled={applying || cohort.surveyFields.length === 0}>
                      {applying ? "Сохраняем..." : application ? "Обновить заявку" : "Отправить заявку"}
                    </Button>
                  </>
                ) : null}
              </form>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function SurveyFieldControl({
  field,
  value,
  onChange
}: {
  field: Cohort["surveyFields"][number];
  value: string;
  onChange: (value: string) => void;
}) {
  const options = getStringOptions(field.options);

  if (field.type === "SELECT") {
    return (
      <label className="grid gap-2 text-sm font-medium">
        {field.label}
        <select
          className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          required={field.required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Выберите вариант</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "TEXTAREA") {
    return (
      <TextAreaField
        label={field.label}
        value={value}
        rows={4}
        required={field.required}
        onChange={onChange}
      />
    );
  }

  return (
    <label className="grid gap-2 text-sm font-medium">
      {field.label}
      <Input required={field.required} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function StudentApplications({ applications }: { applications: Application[] }) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Мои заявки</h2>
      <div className="mt-4 grid gap-3">
        {applications.length === 0 ? (
          <p className="text-sm text-muted">У вас пока нет заявок.</p>
        ) : (
          applications.map((application) => (
            <div key={application.id} className="rounded-md border border-border bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{application.cohort.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    Подана: {formatDate(application.createdAt)}
                  </p>
                  {application.role ? (
                    <p className="mt-1 text-sm text-muted">Роль: {application.role.name}</p>
                  ) : null}
                  {application.reviewComment ? (
                    <p className="mt-2 text-sm text-red-700">Комментарий: {application.reviewComment}</p>
                  ) : null}
                </div>
                <span className="rounded-md bg-primarySoft px-2 py-1 text-xs font-medium text-primary">
                  {statusLabel(application.status)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function AdminCohorts({
  cohorts,
  form,
  saving,
  setForm,
  onCreateCohort
}: {
  cohorts: Cohort[];
  form: CohortForm;
  saving: boolean;
  setForm: React.Dispatch<React.SetStateAction<CohortForm>>;
  onCreateCohort: (event: React.FormEvent) => void;
}) {
  const surveyPreview = useMemo(() => parseSurveyText(form.surveyText), [form.surveyText]);
  const rolesPreview = useMemo(() => parseLines(form.rolesText), [form.rolesText]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
      <Card className="p-5">
        <h2 className="text-lg font-semibold">Когорты</h2>
        <div className="mt-4 grid gap-3">
          {cohorts.length === 0 ? (
            <p className="text-sm text-muted">Когорт пока нет.</p>
          ) : (
            cohorts.map((item) => <CohortRow key={item.id} cohort={item} />)
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Новая когорта</h2>
        <form className="mt-4 grid gap-4" onSubmit={onCreateCohort}>
          <label className="grid gap-2 text-sm font-medium">
            Название
            <Input
              placeholder="2026"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <DateField
              label="Прием заявок с"
              value={form.applicationStart}
              onChange={(value) => setForm((current) => ({ ...current, applicationStart: value }))}
            />
            <DateField
              label="Прием заявок до"
              value={form.applicationEnd}
              onChange={(value) => setForm((current) => ({ ...current, applicationEnd: value }))}
            />
            <DateField
              label="Практика с"
              value={form.practiceStart}
              onChange={(value) => setForm((current) => ({ ...current, practiceStart: value }))}
            />
            <DateField
              label="Практика до"
              value={form.practiceEnd}
              onChange={(value) => setForm((current) => ({ ...current, practiceEnd: value }))}
            />
          </div>

          <TextAreaField
            label="Поля анкеты"
            value={form.surveyText}
            rows={5}
            onChange={(value) => setForm((current) => ({ ...current, surveyText: value }))}
          />
          <p className="text-xs leading-5 text-muted">
            Для списка вариантов пишем так: Вопрос | вариант 1, вариант 2
          </p>

          <TextAreaField
            label="Роли/треки"
            value={form.rolesText}
            rows={4}
            onChange={(value) => setForm((current) => ({ ...current, rolesText: value }))}
          />

          <TextAreaField
            label="Тестовое задание"
            value={form.testTaskContent}
            rows={5}
            onChange={(value) => setForm((current) => ({ ...current, testTaskContent: value }))}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.testTaskPublished}
              onChange={(event) => setForm((current) => ({ ...current, testTaskPublished: event.target.checked }))}
            />
            Опубликовать тестовое задание сразу
          </label>

          <div className="rounded-md border border-border bg-white p-3 text-sm">
            <p className="font-medium">Будет создано:</p>
            <p className="mt-2 text-muted">Поля анкеты: {surveyPreview.length}</p>
            <p className="text-muted">Роли: {rolesPreview.length ? rolesPreview.join(", ") : "не заданы"}</p>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Создаем..." : "Создать когорту"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function CohortRow({ cohort }: { cohort: Cohort }) {
  return (
    <div className="rounded-md border border-border bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{cohort.name}</p>
          <p className="mt-1 text-sm text-muted">
            Анкета: {cohort.surveyFields.length} · Роли: {cohort.roles.length}
          </p>
        </div>
        <span className="rounded-md bg-primarySoft px-2 py-1 text-xs font-medium text-primary">
          {cohort.testTask?.publishedAt ? "ТЗ опубликовано" : "ТЗ не опубликовано"}
        </span>
      </div>
      <p className="mt-3 text-xs text-muted">
        Прием заявок: {formatDate(cohort.applicationStart)} - {formatDate(cohort.applicationEnd)}
      </p>
      <p className="mt-1 text-xs text-muted">
        Практика: {formatDate(cohort.practiceStart)} - {formatDate(cohort.practiceEnd)}
      </p>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  rows,
  required,
  onChange
}: {
  label: string;
  value: string;
  rows: number;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <textarea
        className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
        rows={rows}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSurveyText(value: string) {
  return parseLines(value).map((line, index) => {
    const [label, rawOptions] = line.split("|").map((part) => part.trim());
    const options = rawOptions
      ?.split(",")
      .map((option) => option.trim())
      .filter(Boolean);

    return {
      label,
      type: options?.length ? ("SELECT" as const) : ("TEXT" as const),
      options,
      required: true,
      order: index
    };
  });
}

function buildInitialAnswersByCohort(cohorts: Cohort[], applications: Application[]): AnswersByCohort {
  return Object.fromEntries(
    cohorts.map((cohort) => [cohort.id, buildInitialAnswers(cohort, applications)])
  );
}

function buildInitialAnswers(cohort: Cohort | null, applications: Application[]): Answers {
  if (!cohort) {
    return {};
  }

  const currentApplication = applications.find((application) => application.cohort.id === cohort.id);
  if (currentApplication) {
    return normalizeAnswers(currentApplication.answers);
  }

  const previousApplications = applications
    .filter((application) => application.cohort.id !== cohort.id)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return cohort.surveyFields.reduce<Answers>((result, field) => {
    for (const application of previousApplications) {
      const previousField = application.cohort.surveyFields.find(
        (candidate) => normalizeLabel(candidate.label) === normalizeLabel(field.label)
      );
      const previousValue = previousField ? application.answers[previousField.id] : undefined;

      if (typeof previousValue === "string" && previousValue.trim()) {
        result[field.id] = previousValue;
        break;
      }
    }

    return result;
  }, {});
}

function applicationForCohort(applications: Application[], cohortId: string) {
  return applications.find((application) => application.cohort.id === cohortId);
}

function normalizeAnswers(value: Record<string, unknown>): Answers {
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, answer]) => [key, answer])
  );
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getStringOptions(value: unknown) {
  return Array.isArray(value) ? value.filter((option): option is string => typeof option === "string") : [];
}

function statusLabel(status: Application["status"]) {
  const labels = {
    PENDING: "На рассмотрении",
    APPROVED: "Одобрена",
    REJECTED: "Отклонена"
  };

  return labels[status];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value));
}
