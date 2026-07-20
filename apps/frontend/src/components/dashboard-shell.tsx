"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ClipboardList, ExternalLink, FileText, LayoutDashboard, ListChecks, LogOut, Plus, Search, Settings, Trash2, UserRound } from "lucide-react";
import {
  AdminApplication,
  ApiError,
  Application,
  AuthUser,
  Cohort,
  activeCohort,
  clearToken,
  createCohort,
  currentUser,
  getTaskBoard,
  listAdminDocuments,
  listCohortApplications,
  listCohorts,
  myApplications,
  submitApplication,
  updateCohortRoles,
  updateCohortSurvey,
  updateApplicationStatus,
  updateTestTask
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OverviewLink } from "@/components/overview-link";
import { StudentDocuments } from "@/components/student-documents";
import { AdminDocumentsPanel } from "@/components/admin-documents";
import { TaskBoard } from "@/components/task-board";
import { buildAdminOverview, filterAdminApplications, type AdminOverviewData } from "@/lib/admin-dashboard";

type CohortForm = {
  name: string;
  applicationStart: string;
  applicationEnd: string;
  practiceStart: string;
  practiceEnd: string;
  surveyFields: SurveyFieldDraft[];
  rolesText: string;
  testTaskContent: string;
  testTaskPublished: boolean;
};

type SurveyFieldDraft = {
  key: string;
  label: string;
  type: "TEXT" | "TEXTAREA" | "SELECT";
  optionsText: string;
  required: boolean;
};

let surveyDraftSequence = 0;

type Answers = Record<string, string>;
type AnswersByCohort = Record<string, Answers>;
type StudentTab = "profile" | "applications" | "documents" | "tasks";
type AdminTab = "overview" | "applications" | "documents" | "tasks" | "settings";

const initialForm: CohortForm = {
  name: "",
  applicationStart: "",
  applicationEnd: "",
  practiceStart: "",
  practiceEnd: "",
  surveyFields: [
    surveyDraft("ФИО"),
    surveyDraft("Группа"),
    surveyDraft("Желаемая роль", "SELECT", "Frontend, Backend, Аналитик"),
    surveyDraft("Стек технологий", "TEXTAREA")
  ],
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [expandedCohortId, setExpandedCohortId] = useState<string | null>(null);
  const [studentTab, setStudentTab] = useState<StudentTab>("profile");
  const [studentCohortId, setStudentCohortId] = useState("");

  const isAdmin = user?.role === "ADMIN";
  const approvedApplications = applications.filter((application) => application.status === "APPROVED");
  const approvedApplication = approvedApplications.find((application) => application.cohort.id === studentCohortId)
    ?? approvedApplications[0];
  const editableCohorts = isAdmin
    ? []
    : activeCohorts.filter((item) => applicationForCohort(applications, item.id)?.status !== "APPROVED");
  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!approvedApplications.some((application) => application.cohort.id === studentCohortId)) {
      setStudentCohortId(approvedApplications[0]?.cohort.id ?? "");
    }
  }, [applications, studentCohortId]);

  async function loadDashboard() {
    setLoading(true);
    setLoadError(null);

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
      if (caught instanceof ApiError && caught.status === 401) {
        clearToken();
        router.push("/auth");
      } else {
        setLoadError(caught instanceof Error ? caught.message : "Не удалось загрузить личный кабинет");
      }
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
        surveyFields: serializeSurveyFields(form.surveyFields),
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
      setMessage(null);
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
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <OverviewLink />
          <div className="hidden border-l border-border pl-4 text-sm text-muted sm:block">
            <p className="text-sm text-muted">Личный кабинет</p>
          </div>
        </div>
        <Button variant="secondary" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Выйти
        </Button>
      </header>

      {loadError ? (
        <Card className="mb-4 border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">{loadError}</p>
        </Card>
      ) : null}

      {loading ? <Card className="p-5 text-sm text-muted">Загрузка...</Card> : null}

      {!loading && (
        <div className="grid gap-4">
          {isAdmin ? (
            <>
              <ProfileCard user={user} />
              <AdminCohorts
                cohorts={cohorts}
                form={form}
                saving={saving}
                actionError={error}
                actionMessage={message}
                setForm={setForm}
                onCreateCohort={onCreateCohort}
                onCohortChange={loadDashboard}
              />
            </>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              <StudentNavigation
                active={studentTab}
                user={user}
                onChange={(tab) => {
                  setError(null);
                  setMessage(null);
                  setStudentTab(tab);
                }}
              />
              <section className="min-w-0">
                <StudentSectionHeader active={studentTab} />

                {studentTab === "profile" ? (
                  <div className="grid gap-4">
                    <ProfileCard user={user} />
                    <ActiveCohortCard
                      applications={approvedApplications}
                      selectedCohortId={approvedApplication?.cohort.id ?? ""}
                      onChange={setStudentCohortId}
                    />
                  </div>
                ) : null}

                {studentTab === "applications" ? (
                  <div className="grid gap-4">
                    <ApplicationFormCard
                      cohorts={editableCohorts}
                      applications={applications}
                      answersByCohort={answersByCohort}
                      applying={applying}
                      actionError={error}
                      actionMessage={message}
                      expandedCohortId={expandedCohortId}
                      onToggleCohort={(cohortId) => {
                        setError(null);
                        setMessage(null);
                        setExpandedCohortId((current) => (current === cohortId ? null : cohortId));
                      }}
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
                  </div>
                ) : null}

                {studentTab === "documents" && approvedApplication ? (
                  <StudentDocuments application={approvedApplication} />
                ) : null}
                {studentTab === "documents" && !approvedApplication ? (
                  <UnavailableSection text="Документы станут доступны после одобрения заявки." />
                ) : null}

                {studentTab === "tasks" && approvedApplication && user ? (
                  <TaskBoard cohortId={approvedApplication.cohort.id} currentUserId={user.id} />
                ) : null}
                {studentTab === "tasks" && !approvedApplication ? (
                  <UnavailableSection text="Задачи станут доступны после одобрения заявки." />
                ) : null}
              </section>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function StudentNavigation({
  active,
  user,
  onChange
}: {
  active: StudentTab;
  user: AuthUser | null;
  onChange: (tab: StudentTab) => void;
}) {
  const items: Array<{
    id: StudentTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "profile", label: "Профиль", icon: UserRound },
    { id: "applications", label: "Заявки", icon: ClipboardList },
    { id: "documents", label: "Документы", icon: FileText },
    { id: "tasks", label: "Задачи", icon: ListChecks }
  ];

  return (
    <aside className="overflow-hidden rounded-md border border-border bg-white lg:sticky lg:top-6">
      <div className="hidden border-b border-border px-4 py-4 lg:block">
        <p className="text-sm font-semibold">Разделы кабинета</p>
        <p className="mt-1 truncate text-xs text-muted">{user?.email}</p>
      </div>
      <nav className="grid grid-cols-4 p-1.5 lg:flex lg:flex-col" aria-label="Разделы кабинета">
        {items.map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={selected ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-10 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm ${
                selected
                  ? "bg-primarySoft text-primary"
                  : "text-muted hover:bg-slate-50 hover:text-foreground"
              }`}
              onClick={() => onChange(item.id)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function StudentSectionHeader({ active }: { active: StudentTab }) {
  const sections: Record<StudentTab, { title: string; description: string }> = {
    profile: { title: "Профиль", description: "Учётная запись и активная практика" },
    applications: { title: "Заявки", description: "Доступные практики и статусы заявок" },
    documents: { title: "Документы", description: "Формы и отчёт по выбранной практике" },
    tasks: { title: "Задачи", description: "Планирование работы и прогресс" }
  };
  const section = sections[active];

  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold">{section.title}</h2>
      <p className="mt-1 text-sm text-muted">{section.description}</p>
    </div>
  );
}

function ProfileCard({ user }: { user: AuthUser | null }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primarySoft text-primary">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Учётная запись</h2>
          <p className="mt-1 truncate text-sm text-muted">
            {user?.email ?? "Неизвестный пользователь"}
          </p>
        </div>
        {user ? (
          <span className="ml-auto rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-muted">
            {user.role === "ADMIN" ? "Администратор" : "Студент"}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function ActiveCohortCard({
  applications,
  selectedCohortId,
  onChange
}: {
  applications: Application[];
  selectedCohortId: string;
  onChange: (cohortId: string) => void;
}) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Рабочая когорта</h2>
      {applications.length ? (
        <label className="mt-3 grid gap-2 text-sm font-medium">
          Документы и задачи
          <select
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={selectedCohortId}
            onChange={(event) => onChange(event.target.value)}
          >
            {applications.map((application) => (
              <option key={application.id} value={application.cohort.id}>{application.cohort.name}</option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mt-2 text-sm text-muted">Рабочая когорта появится после одобрения заявки.</p>
      )}
    </Card>
  );
}

function ApplicationFormCard({
  cohorts,
  applications,
  answersByCohort,
  applying,
  actionError,
  actionMessage,
  expandedCohortId,
  onToggleCohort,
  onAnswerChange,
  onSubmit
}: {
  cohorts: Cohort[];
  applications: Application[];
  answersByCohort: AnswersByCohort;
  applying: boolean;
  actionError: string | null;
  actionMessage: string | null;
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

                    <InlineFeedback error={actionError} message={actionMessage} />

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
                  <div className="mt-3 rounded-md border border-border bg-slate-50 p-3">
                    <p className="text-sm font-medium">Тестовое задание</p>
                    {application.cohort.testTask?.publishedAt ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
                        {application.cohort.testTask.content}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted">Тестовое задание появится позже.</p>
                    )}
                  </div>
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
  actionError,
  actionMessage,
  setForm,
  onCreateCohort,
  onCohortChange
}: {
  cohorts: Cohort[];
  form: CohortForm;
  saving: boolean;
  actionError: string | null;
  actionMessage: string | null;
  setForm: React.Dispatch<React.SetStateAction<CohortForm>>;
  onCreateCohort: (event: React.FormEvent) => void;
  onCohortChange: () => Promise<void>;
}) {
  const [selectedCohortId, setSelectedCohortId] = useState(cohorts[0]?.id ?? "");
  const [showCreateForm, setShowCreateForm] = useState(cohorts.length === 0);
  const rolesPreview = useMemo(() => parseLines(form.rolesText), [form.rolesText]);
  const selectedCohort = cohorts.find((cohort) => cohort.id === selectedCohortId) ?? cohorts[0];
  const copySource = selectedCohort ?? cohorts[0];

  useEffect(() => {
    if (!cohorts.some((cohort) => cohort.id === selectedCohortId)) {
      setSelectedCohortId(cohorts[0]?.id ?? "");
    }
  }, [cohorts, selectedCohortId]);

  function copySettingsFromCohort(cohort: Cohort) {
    setForm((current) => ({
      ...current,
      surveyFields: surveyDraftsFromCohort(cohort),
      rolesText: cohortRolesToText(cohort),
      testTaskContent: cohort.testTask?.content ?? current.testTaskContent,
      testTaskPublished: Boolean(cohort.testTask?.publishedAt)
    }));
  }

  return (
    <div className="grid gap-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="grid min-w-60 flex-1 gap-2 text-sm font-medium">
            Рабочая когорта
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={selectedCohort?.id ?? ""}
              disabled={cohorts.length === 0}
              onChange={(event) => setSelectedCohortId(event.target.value)}
            >
              {cohorts.length === 0 ? <option value="">Когорт пока нет</option> : null}
              {cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="secondary" onClick={() => setShowCreateForm((current) => !current)}>
            <Plus className="mr-2 h-4 w-4" />
            {showCreateForm ? "Скрыть форму" : "Новая когорта"}
          </Button>
        </div>
      </Card>

      {showCreateForm ? <Card className="p-5">
        <h2 className="text-lg font-semibold">Новая когорта</h2>
        <form className="mt-4 grid gap-4" onSubmit={onCreateCohort}>
          {copySource ? (
            <Button type="button" variant="secondary" onClick={() => copySettingsFromCohort(copySource)}>
              Скопировать анкету, роли и ТЗ из "{copySource.name}"
            </Button>
          ) : null}

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

          <SurveyEditor
            fields={form.surveyFields}
            onChange={(surveyFields) => setForm((current) => ({ ...current, surveyFields }))}
          />

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
            <p className="mt-2 text-muted">Поля анкеты: {form.surveyFields.filter((field) => field.label.trim()).length}</p>
            <p className="text-muted">Роли: {rolesPreview.length ? rolesPreview.join(", ") : "не заданы"}</p>
          </div>

          <InlineFeedback error={actionError} message={actionMessage} />

          <Button type="submit" disabled={saving}>
            {saving ? "Создаем..." : "Создать когорту"}
          </Button>
        </form>
      </Card> : null}

      {selectedCohort ? (
        <CohortRow key={selectedCohort.id} cohort={selectedCohort} onSaved={onCohortChange} />
      ) : (
        <UnavailableSection text="Создайте первую когорту, чтобы открыть рабочие разделы." />
      )}
    </div>
  );
}

function CohortRow({ cohort, onSaved }: { cohort: Cohort; onSaved: () => Promise<void> }) {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [surveyFields, setSurveyFields] = useState(surveyDraftsFromCohort(cohort));
  const [roleNames, setRoleNames] = useState(cohort.roles.map((role) => role.name));
  const [newRole, setNewRole] = useState("");
  const [content, setContent] = useState(cohort.testTask?.content ?? "");
  const [published, setPublished] = useState(Boolean(cohort.testTask?.publishedAt));
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  function addRole() {
    const roleName = newRole.trim();
    if (!roleName || roleNames.includes(roleName)) {
      return;
    }

    setRoleNames((current) => [...current, roleName]);
    setNewRole("");
  }

  async function onSaveSettings() {
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsMessage(null);

    try {
      await updateCohortSurvey(cohort.id, serializeSurveyFields(surveyFields));
      const result = await updateCohortRoles(cohort.id, roleNames);
      await onSaved();
      setSettingsMessage(
        result.warning
          ? "Настройки сохранены. Удаленная роль уже была назначена практиканту, назначение у заявки сброшено."
          : "Настройки анкеты и ролей сохранены"
      );
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Не получилось сохранить анкету и роли");
    } finally {
      setSavingSettings(false);
    }
  }

  async function onSaveTask() {
    setSavingTask(true);
    setTaskError(null);

    try {
      await updateTestTask(cohort.id, content, published);
      await onSaved();
    } catch (caught) {
      setTaskError(caught instanceof Error ? caught.message : "Не получилось сохранить тестовое задание");
    } finally {
      setSavingTask(false);
    }
  }

  return (
    <section className="grid gap-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Активная когорта</p>
            <h2 className="mt-1 text-xl font-semibold">{cohort.name}</h2>
            <p className="mt-2 text-sm text-muted">
              Анкета: {cohort.surveyFields.length} · Роли: {cohort.roles.length}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primarySoft px-2 py-1 text-xs font-medium text-primary">
              {cohort.testTask?.publishedAt ? "ТЗ опубликовано" : "ТЗ не опубликовано"}
            </span>
            <Button asChild type="button" variant="secondary">
              <a href={`/apply/${cohort.id}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />Публичная анкета
              </a>
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
          <p>Прием заявок: {formatDate(cohort.applicationStart)} - {formatDate(cohort.applicationEnd)}</p>
          <p>Практика: {formatDate(cohort.practiceStart)} - {formatDate(cohort.practiceEnd)}</p>
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <DashboardTabs
          active={activeTab}
          variant="sidebar"
          items={[
            { id: "overview", label: "Обзор", icon: LayoutDashboard },
            { id: "applications", label: "Заявки", icon: ClipboardList },
            { id: "documents", label: "Документы", icon: FileText },
            { id: "tasks", label: "Задачи", icon: ListChecks },
            { id: "settings", label: "Настройки", icon: Settings }
          ]}
          onChange={(tab) => setActiveTab(tab as AdminTab)}
        />

        <div className="min-w-0">
          {activeTab === "overview" ? <AdminOverview cohort={cohort} onNavigate={setActiveTab} /> : null}
          {activeTab === "applications" ? <AdminApplicationsPanel cohort={cohort} /> : null}
          {activeTab === "documents" ? <AdminDocumentsPanel cohort={cohort} /> : null}
          {activeTab === "tasks" ? <TaskBoard cohortId={cohort.id} currentUserId="" isAdmin /> : null}

          {activeTab === "settings" ? (
        <Card className="p-5">
          <div>
            <h3 className="text-base font-semibold">Анкета и роли</h3>
            <p className="mt-1 text-sm text-muted">Настройки применяются только к выбранной когорте.</p>
          </div>

          <div className="mt-4 grid gap-3">
            <SurveyEditor fields={surveyFields} onChange={setSurveyFields} />

            <div className="grid gap-2">
              <p className="text-sm font-medium">Роли/треки</p>
              {roleNames.length === 0 ? (
                <p className="text-sm text-muted">Ролей пока нет.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {roleNames.map((roleName) => (
                    <span
                      key={roleName}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-2 py-1 text-sm"
                    >
                      {roleName}
                      <button
                        className="text-muted hover:text-red-700"
                        type="button"
                        onClick={() => setRoleNames((current) => current.filter((item) => item !== roleName))}
                      >
                        Удалить
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Например, Backend"
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value)}
                />
                <Button type="button" variant="secondary" disabled={!newRole.trim()} onClick={addRole}>
                  Добавить
                </Button>
              </div>
            </div>

            {settingsError ? <p className="text-sm text-red-700">{settingsError}</p> : null}
            {settingsMessage ? <p className="text-sm text-green-700">{settingsMessage}</p> : null}

            <Button type="button" disabled={savingSettings} onClick={onSaveSettings}>
              {savingSettings ? "Сохраняем..." : "Сохранить анкету и роли"}
            </Button>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-base font-semibold">Тестовое задание</h3>
            <div className="mt-4 grid gap-3">
              <TextAreaField label="Содержание задания" value={content} rows={5} onChange={setContent} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(event) => setPublished(event.target.checked)}
                />
                Опубликовать тестовое задание
              </label>
              {taskError ? <p className="text-sm text-red-700">{taskError}</p> : null}
              <Button type="button" disabled={savingTask || !content.trim()} onClick={onSaveTask}>
                {savingTask ? "Сохраняем..." : "Сохранить тестовое задание"}
              </Button>
            </div>
          </div>
        </Card>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AdminOverview({ cohort, onNavigate }: { cohort: Cohort; onNavigate: (tab: AdminTab) => void }) {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      setLoading(true);
      setError(null);

      try {
        const [applicationResult, documentResult, taskResult] = await Promise.all([
          listCohortApplications(cohort.id),
          listAdminDocuments(cohort.id),
          getTaskBoard(cohort.id, true)
        ]);

        if (!active) return;

        setData(buildAdminOverview(applicationResult.applications, documentResult.rows, taskResult));
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Не удалось загрузить сводку когорты");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOverview();
    return () => {
      active = false;
    };
  }, [cohort.id, reloadKey]);

  if (loading) {
    return <Card className="p-5 text-sm text-muted">Загрузка сводки...</Card>;
  }

  if (error || !data) {
    return (
      <Card className="border-red-200 bg-red-50 p-5" role="alert">
        <p className="text-sm font-medium text-red-700">{error ?? "Сводка недоступна"}</p>
        <Button type="button" variant="secondary" className="mt-3" onClick={() => setReloadKey((value) => value + 1)}>
          Повторить
        </Button>
      </Card>
    );
  }

  const incompleteDocumentProfiles = data.participants - data.completeDocumentProfiles;
  const documentProgress = overviewPercent(data.completeDocumentProfiles, data.participants);
  const taskProgress = overviewPercent(data.completedTasks, data.totalTasks);
  const metrics = [
    { label: "Все заявки", value: data.totalApplications, detail: `${data.pendingApplications} ожидают решения, ${data.rejectedApplications} отклонено`, icon: ClipboardList, tab: "applications" as AdminTab },
    { label: "Участники", value: data.approvedApplications, detail: `${data.participants} доступны в документах`, icon: UserRound, tab: "applications" as AdminTab },
    { label: "Данные документов", value: `${data.completeDocumentProfiles}/${data.participants}`, detail: `${incompleteDocumentProfiles} анкет заполнено не полностью`, icon: FileText, tab: "documents" as AdminTab },
    { label: "Загруженные отчёты", value: `${data.reportsUploaded}/${data.participants}`, detail: `${data.reportsApproved} одобрено`, icon: FileText, tab: "documents" as AdminTab },
    { label: "Отчёты на проверке", value: data.reportsToReview, detail: `${data.reportsForRevision} возвращено на доработку`, icon: FileText, tab: "documents" as AdminTab },
    { label: "Выполненные задачи", value: `${data.completedTasks}/${data.totalTasks}`, detail: `${data.incompleteTasks} без результата`, icon: ListChecks, tab: "tasks" as AdminTab }
  ];

  return (
    <section className="grid gap-5" aria-labelledby="admin-overview-title">
      <div>
        <h3 id="admin-overview-title" className="text-lg font-semibold">Сводка по когорте</h3>
        <p className="mt-1 text-sm text-muted">Текущее состояние заявок, документов и задач.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <button
              key={metric.label}
              type="button"
              className="min-h-32 rounded-md border border-border bg-white p-4 text-left shadow-panel transition hover:border-primary/40 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => onNavigate(metric.tab)}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-muted">{metric.label}</span>
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-4 text-3xl font-semibold">{metric.value}</p>
              <p className="mt-2 text-xs text-muted">{metric.detail}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 border-t border-border pt-5 md:grid-cols-2">
        <OverviewProgress
          label="Заполненность документов"
          value={documentProgress}
          detail={`${data.completeDocumentProfiles} из ${data.participants} участников заполнили данные`}
        />
        <OverviewProgress
          label="Выполнение задач"
          value={taskProgress}
          detail={`${data.completedTasks} из ${data.totalTasks} задач содержат результат`}
        />
      </div>

      {(data.pendingApplications > 0 || incompleteDocumentProfiles > 0 || data.reportsToReview > 0 || data.reportsForRevision > 0) ? (
        <div className="border-t border-border pt-5">
          <h4 className="font-semibold">Требуют внимания</h4>
          <div className="mt-3 grid gap-2 text-sm">
            {data.pendingApplications > 0 ? (
              <button type="button" className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-3 text-left hover:bg-slate-50" onClick={() => onNavigate("applications")}>
                <span>Заявки без решения</span><span className="font-semibold text-primary">{data.pendingApplications}</span>
              </button>
            ) : null}
            {incompleteDocumentProfiles > 0 ? (
              <button type="button" className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-3 text-left hover:bg-slate-50" onClick={() => onNavigate("documents")}>
                <span>Участники с незаполненными данными</span><span className="font-semibold text-primary">{incompleteDocumentProfiles}</span>
              </button>
            ) : null}
            {data.reportsToReview > 0 ? (
              <button type="button" className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-3 text-left hover:bg-slate-50" onClick={() => onNavigate("documents")}>
                <span>Новые отчёты на проверке</span><span className="font-semibold text-primary">{data.reportsToReview}</span>
              </button>
            ) : null}
            {data.reportsForRevision > 0 ? (
              <button type="button" className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-3 text-left hover:bg-slate-50" onClick={() => onNavigate("documents")}>
                <span>Отчёты на доработке</span><span className="font-semibold text-red-700">{data.reportsForRevision}</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="border-t border-border pt-5 text-sm text-muted">Сейчас нет заявок и отчётов, ожидающих действий администратора.</p>
      )}
    </section>
  );
}

function OverviewProgress({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-semibold text-primary">{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className="h-full bg-primary transition-[width]" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">{detail}</p>
    </div>
  );
}

function overviewPercent(completed: number, total: number) {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

function DashboardTabs({
  active,
  items,
  variant = "horizontal",
  onChange
}: {
  active: string;
  items: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
  variant?: "horizontal" | "sidebar";
  onChange: (id: string) => void;
}) {
  const sidebar = variant === "sidebar";

  return (
    <div
      className={sidebar
        ? "overflow-hidden rounded-md border border-border bg-white lg:sticky lg:top-6"
        : "overflow-x-auto border-b border-border"}
      role="tablist"
      aria-label="Разделы кабинета"
    >
      {sidebar ? (
        <div className="hidden border-b border-border px-4 py-4 lg:block">
          <p className="text-sm font-semibold">Разделы когорты</p>
        </div>
      ) : null}
      <div className={sidebar ? "grid grid-cols-3 p-1.5 lg:flex lg:flex-col" : "flex min-w-max gap-1"}>
        {items.map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={sidebar
                ? `flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-10 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm ${
                    selected
                      ? "bg-primarySoft text-primary"
                      : "text-muted hover:bg-slate-50 hover:text-foreground"
                  }`
                : `flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    selected
                      ? "border-primary text-primary"
                      : "border-transparent text-muted hover:border-slate-300 hover:text-foreground"
                  }`}
              onClick={() => onChange(item.id)}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UnavailableSection({ text }: { text: string }) {
  return <Card className="p-5 text-sm text-muted">{text}</Card>;
}

function InlineFeedback({ error, message }: { error: string | null; message: string | null }) {
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
        {error}
      </div>
    );
  }

  if (message) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700" role="status">
        {message}
      </div>
    );
  }

  return null;
}

function AdminApplicationsPanel({ cohort }: { cohort: Cohort }) {
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | Application["status"]>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null);
  const [roleSelection, setRoleSelection] = useState<Record<string, string>>({});
  const [rejectComments, setRejectComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [savingApplicationId, setSavingApplicationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadApplications();
  }, [cohort.id]);

  async function loadApplications() {
    setLoading(true);
    setLoadFailed(false);
    setError(null);

    try {
      const result = await listCohortApplications(cohort.id);
      setApplications(result.applications);
      setRoleSelection(
        Object.fromEntries(result.applications.map((application) => [application.id, application.role?.id ?? ""]))
      );
    } catch (caught) {
      setLoadFailed(true);
      setError(caught instanceof Error ? caught.message : "Не получилось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }

  async function approveApplication(application: AdminApplication) {
    const roleId = roleSelection[application.id];
    if (!roleId) {
      setError("Для одобрения нужно выбрать роль");
      return;
    }

    await changeStatus(application, "APPROVED", roleId);
  }

  async function rejectApplication(application: AdminApplication) {
    const reviewComment = rejectComments[application.id]?.trim();
    await changeStatus(application, "REJECTED", undefined, reviewComment);
  }

  async function changeStatus(
    application: AdminApplication,
    status: Application["status"],
    roleId?: string,
    reviewComment?: string
  ) {
    setSavingApplicationId(application.id);
    setError(null);
    setMessage(null);

    try {
      await updateApplicationStatus({
        applicationId: application.id,
        status,
        roleId,
        reviewComment
      });
      setMessage(status === "APPROVED" ? "Заявка одобрена" : "Заявка отклонена");
      setExpandedApplicationId(null);
      await loadApplications();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не получилось обновить статус заявки");
    } finally {
      setSavingApplicationId(null);
    }
  }

  const visibleApplications = filterAdminApplications(applications, statusFilter, searchQuery);

  return (
    <div className="mt-3 grid gap-3 rounded-md border border-border bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">Заявки когорты</p>
          <p className="mt-1 text-sm text-muted">
            Показано: {visibleApplications.length} из {applications.length}
          </p>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(240px,1fr)_190px]">
          <label className="relative">
            <span className="sr-only">Поиск заявок</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
            <Input
              className="pl-9"
              type="search"
              placeholder="ФИО, email, группа или роль"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <select
            aria-label="Статус заявки"
            className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "ALL" | Application["status"])}
          >
            <option value="ALL">Все статусы</option>
            <option value="PENDING">На рассмотрении</option>
            <option value="APPROVED">Одобрена</option>
            <option value="REJECTED">Отклонена</option>
          </select>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted">Загрузка заявок...</p> : null}
      {error ? (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm text-red-700">{error}</p>
          {loadFailed ? <Button type="button" variant="secondary" onClick={loadApplications}>Повторить</Button> : null}
        </div>
      ) : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      {!loading && visibleApplications.length === 0 ? (
        <p className="text-sm text-muted">Заявок по выбранным условиям не найдено.</p>
      ) : null}

      {visibleApplications.map((application) => {
        const isSaving = savingApplicationId === application.id;
        const canApprove = cohort.roles.length > 0;
        const isExpanded = expandedApplicationId === application.id;

        return (
          <div key={application.id} className="grid gap-3 rounded-md border border-border bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{applicationAnswerPreview(application, cohort) || application.user.email}</p>
                <p className="mt-1 text-sm text-muted">{application.user.email}</p>
                <p className="mt-1 text-sm text-muted">Подана: {formatDate(application.createdAt)}</p>
                {application.role ? <p className="mt-1 text-sm text-muted">Роль: {application.role.name}</p> : null}
                {application.reviewComment ? (
                  <p className="mt-2 text-sm text-red-700">Причина отказа: {application.reviewComment}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-primarySoft px-2 py-1 text-xs font-medium text-primary">
                  {statusLabel(application.status)}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setExpandedApplicationId((current) => (current === application.id ? null : application.id))}
                >
                  {isExpanded ? "Свернуть" : "Открыть"}
                </Button>
              </div>
            </div>

            {isExpanded ? (
              <>
                <div className="grid gap-2 rounded-md border border-border bg-slate-50 p-3 text-sm">
                  <p className="font-medium">Ответы анкеты</p>
                  {cohort.surveyFields.length === 0 ? (
                    <p className="text-muted">Поля анкеты не настроены.</p>
                  ) : (
                    cohort.surveyFields.map((field) => (
                      <div key={field.id} className="grid gap-1">
                        <p className="text-muted">{field.label}</p>
                        <p>{formatAnswer(application.answers[field.id])}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <select
                    className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    disabled={!canApprove}
                    value={roleSelection[application.id] ?? ""}
                    onChange={(event) =>
                      setRoleSelection((current) => ({ ...current, [application.id]: event.target.value }))
                    }
                  >
                    <option value="">Выберите роль</option>
                    {cohort.roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <Button type="button" disabled={isSaving || !canApprove} onClick={() => approveApplication(application)}>
                    Одобрить
                  </Button>
                </div>
                {!canApprove ? <p className="text-sm text-red-700">Сначала добавьте роли в настройках когорты.</p> : null}

                <div className="grid gap-2">
                  <TextAreaField
                    label="Комментарий при отклонении (необязательно)"
                    value={rejectComments[application.id] ?? ""}
                    rows={3}
                    onChange={(value) =>
                      setRejectComments((current) => ({ ...current, [application.id]: value }))
                    }
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isSaving}
                    onClick={() => rejectApplication(application)}
                  >
                    Отклонить
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SurveyEditor({
  fields,
  onChange
}: {
  fields: SurveyFieldDraft[];
  onChange: (fields: SurveyFieldDraft[]) => void;
}) {
  function updateField(index: number, values: Partial<SurveyFieldDraft>) {
    onChange(fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...values } : field));
  }

  function moveField(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Поля анкеты</p>
          <p className="mt-1 text-xs text-muted">Настройте тип, обязательность и порядок вопросов.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => onChange([...fields, surveyDraft()])}>
          <Plus className="mr-2 h-4 w-4" />Добавить поле
        </Button>
      </div>

      {fields.length === 0 ? <p className="text-sm text-muted">В анкете пока нет полей.</p> : null}

      {fields.map((field, index) => (
        <div key={field.key} className="grid gap-3 rounded-md border border-border bg-white p-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
            <label className="grid gap-2 text-sm font-medium">
              Вопрос
              <Input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Тип поля
              <select
                className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={field.type}
                onChange={(event) => updateField(index, { type: event.target.value as SurveyFieldDraft["type"] })}
              >
                <option value="TEXT">Короткий текст</option>
                <option value="TEXTAREA">Длинный текст</option>
                <option value="SELECT">Выбор из списка</option>
              </select>
            </label>
            <div className="flex items-end gap-1">
              <IconButton label="Переместить выше" disabled={index === 0} onClick={() => moveField(index, -1)}><ArrowUp className="h-4 w-4" /></IconButton>
              <IconButton label="Переместить ниже" disabled={index === fields.length - 1} onClick={() => moveField(index, 1)}><ArrowDown className="h-4 w-4" /></IconButton>
              <IconButton label="Удалить поле" onClick={() => onChange(fields.filter((_, fieldIndex) => fieldIndex !== index))}><Trash2 className="h-4 w-4" /></IconButton>
            </div>
          </div>

          {field.type === "SELECT" ? (
            <label className="grid gap-2 text-sm font-medium">
              Варианты ответа через запятую
              <Input placeholder="Frontend, Backend, Аналитик" value={field.optionsText} onChange={(event) => updateField(index, { optionsText: event.target.value })} />
            </label>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} />
            Обязательное поле
          </label>
        </div>
      ))}
    </div>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted transition hover:bg-slate-50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onClick}
    >
      {children}
    </button>
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

function cohortRolesToText(cohort: Cohort) {
  return cohort.roles.map((role) => role.name).join("\n");
}

function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function surveyDraft(
  label = "",
  type: SurveyFieldDraft["type"] = "TEXT",
  optionsText = "",
  required = true
): SurveyFieldDraft {
  return { key: `draft-${surveyDraftSequence++}`, label, type, optionsText, required };
}

function surveyDraftsFromCohort(cohort: Cohort): SurveyFieldDraft[] {
  return cohort.surveyFields.map((field) => ({
    key: field.id,
    label: field.label,
    type: field.type,
    optionsText: getStringOptions(field.options).join(", "),
    required: field.required
  }));
}

function serializeSurveyFields(fields: SurveyFieldDraft[]) {
  return fields
    .filter((field) => field.label.trim())
    .map((field, order) => {
      const options = field.type === "SELECT"
        ? field.optionsText.split(",").map((option) => option.trim()).filter(Boolean)
        : undefined;
      if (field.type === "SELECT" && options?.length === 0) {
        throw new Error(`Добавьте варианты ответа для поля «${field.label.trim()}»`);
      }
      return {
        label: field.label.trim(),
        type: field.type,
        options,
        required: field.required,
        order
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

function applicationAnswerPreview(application: AdminApplication, cohort: Cohort) {
  const fioField = cohort.surveyFields.find((field) => normalizeLabel(field.label).includes("фио"));
  const value = fioField ? application.answers[fioField.id] : undefined;
  return typeof value === "string" ? value : "";
}

function formatAnswer(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "Да" : "Нет";
  }

  return "—";
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
