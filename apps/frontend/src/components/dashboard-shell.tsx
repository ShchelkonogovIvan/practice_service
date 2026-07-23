"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowDown, ArrowUp, ClipboardList, Download, ExternalLink, FileText, LayoutDashboard, ListChecks, LogOut, Plus, RotateCcw, Search, Settings, Trash2, Upload, UserMinus, UserRound } from "lucide-react";
import {
  AdminApplication,
  ApiError,
  Application,
  AuthUser,
  Cohort,
  InAppNotification,
  activeCohort,
  clearApplicationDraft,
  clearTestTaskDraft,
  clearToken,
  createCohort,
  currentUser,
  downloadApiFile,
  getApplicationDraft,
  getTestTaskDraft,
  getTaskBoard,
  listAdminDocuments,
  listCohortApplications,
  listCohorts,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  myApplications,
  saveApplicationDraft,
  saveTestTaskDraft,
  saveTestTaskAnswer,
  setCohortCompletion,
  submitApplication,
  reviewTestTaskAnswer,
  updateCohortRoles,
  updateCohortSurvey,
  updateApplicationStatus,
  updateMyApplication,
  updateTestTask,
  uploadTestTaskFile
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OverviewLink } from "@/components/overview-link";
import { StudentDocuments } from "@/components/student-documents";
import { AdminDocumentsPanel } from "@/components/admin-documents";
import { TaskBoard } from "@/components/task-board";
import { buildAdminOverview, filterAdminApplications, type AdminOverviewData } from "@/lib/admin-dashboard";
import { NotificationCenter } from "@/components/notification-center";

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
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const isAdmin = user?.role === "ADMIN";
  const selectedApplication = applications.find((application) => application.cohort.id === studentCohortId)
    ?? applications[0];
  const approvedApplication = selectedApplication?.status === "APPROVED" ? selectedApplication : null;
  const editableCohorts = isAdmin
    ? []
    : uniqueCohorts([
        ...activeCohorts.filter((item) => !applicationForCohort(applications, item.id)),
        ...applications
          .filter((application) => application.status === "PENDING" && !isCohortClosed(application.cohort))
          .map((application) => application.cohort)
      ]);
  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!applications.some((application) => application.cohort.id === studentCohortId)) {
      setStudentCohortId(applications[0]?.cohort.id ?? "");
    }
  }, [applications, studentCohortId]);

  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(refreshNotifications, 30_000);
    return () => window.clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (user?.role !== "STUDENT") return;

    const refresh = () => {
      myApplications()
        .then((result) => setApplications(result.applications))
        .catch(() => undefined);
    };
    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [user?.id, user?.role]);

  async function loadDashboard() {
    setLoading(true);
    setLoadError(null);

    try {
      const [userResult, applicationResult, cohortResult, notificationResult] = await Promise.all([
        currentUser(),
        myApplications(),
        activeCohort(),
        listNotifications().catch(() => ({ notifications: [], unreadCount: 0 }))
      ]);

      setUser(userResult.user);
      setApplications(applicationResult.applications);
      setActiveCohorts(cohortResult.cohorts ?? (cohortResult.cohort ? [cohortResult.cohort] : []));
      setNotifications(notificationResult.notifications);
      setUnreadNotifications(notificationResult.unreadCount);
      const answerCohorts = uniqueCohorts([
        ...(cohortResult.cohorts ?? []),
        ...applicationResult.applications.map((application) => application.cohort)
      ]);
      const initialAnswers = buildInitialAnswersByCohort(answerCohorts, applicationResult.applications);
      setAnswersByCohort(Object.fromEntries(
        answerCohorts.map((cohort) => [
          cohort.id,
          { ...(initialAnswers[cohort.id] ?? {}), ...getApplicationDraft(cohort.id) }
        ])
      ));

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

  async function refreshNotifications() {
    try {
      const result = await listNotifications();
      setNotifications(result.notifications);
      setUnreadNotifications(result.unreadCount);
    } catch {
      // Keep the rest of the dashboard available during a background refresh failure.
    }
  }

  async function refreshAdminCohorts() {
    const cohortList = await listCohorts();
    setCohorts(cohortList.cohorts);
  }

  function openNotification(notification: InAppNotification) {
    if (!notification.readAt) {
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt } : item));
      setUnreadNotifications((current) => Math.max(0, current - 1));
      void markNotificationRead(notification.id).catch(refreshNotifications);
    }

    if (!isAdmin) {
      const target: Record<InAppNotification["section"], StudentTab> = {
        APPLICATIONS: "applications",
        DOCUMENTS: "documents",
        TASKS: "tasks"
      };
      setStudentTab(target[notification.section]);
    }
  }

  function readAllNotifications() {
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.readAt ? item : { ...item, readAt }));
    setUnreadNotifications(0);
    void markAllNotificationsRead().catch(refreshNotifications);
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
      await refreshAdminCohorts();
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
      if (activeApplication) {
        await updateMyApplication(activeApplication.id, answers);
      } else {
        await submitApplication(cohort.id, answers);
      }
      clearApplicationDraft(cohort.id);
      setMessage(activeApplication ? "Заявка обновлена" : "Заявка отправлена");
      setExpandedCohortId(null);
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не получилось отправить заявку");
    } finally {
      setApplying(false);
    }
  }

  function onApplicationAnswerChange(cohortId: string, fieldId: string, value: string) {
    setAnswersByCohort((current) => {
      const answers = { ...(current[cohortId] ?? {}), [fieldId]: value };
      saveApplicationDraft(cohortId, answers);
      return { ...current, [cohortId]: answers };
    });
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <OverviewLink />
          <div className="hidden border-l border-border pl-4 text-sm text-muted sm:block">
            <p className="text-sm text-muted">Личный кабинет</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationCenter
            notifications={notifications}
            unreadCount={unreadNotifications}
            onOpen={openNotification}
            onReadAll={readAllNotifications}
          />
          <Button className="w-10 px-0 sm:w-auto sm:px-4" variant="secondary" onClick={logout} title="Выйти" aria-label="Выйти">
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Выйти</span>
          </Button>
        </div>
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
                onCohortChange={refreshAdminCohorts}
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
                      applications={applications}
                      selectedCohortId={selectedApplication?.cohort.id ?? ""}
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
                      onAnswerChange={onApplicationAnswerChange}
                      onSubmit={onApplyToCohort}
                    />
                    <StudentApplications
                      applications={applications}
                      onEdit={(application) => {
                        setExpandedCohortId(application.cohort.id);
                        window.requestAnimationFrame(() => {
                          document.getElementById(`application-form-${application.cohort.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                        });
                      }}
                    />
                  </div>
                ) : null}

                {studentTab === "documents" && approvedApplication ? (
                  <StudentDocuments application={approvedApplication} />
                ) : null}
                {studentTab === "documents" && !approvedApplication ? (
                  <UnavailableSection text="Документы станут доступны после одобрения заявки." />
                ) : null}

                {studentTab === "tasks" && user ? (
                  <StudentTasks
                    applications={applications}
                    selectedApplication={selectedApplication ?? null}
                    approvedApplication={approvedApplication}
                    selectedCohortId={selectedApplication?.cohort.id ?? ""}
                    currentUserId={user.id}
                    onCohortChange={setStudentCohortId}
                    onApplicationUpdated={(updated) => {
                      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
                    }}
                  />
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
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
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
          <span className="ml-auto shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-muted">
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
        <label className="mt-3 block">
          <span className="sr-only">Рабочая когорта</span>
          <select
            aria-label="Рабочая когорта"
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={selectedCohortId}
            onChange={(event) => onChange(event.target.value)}
          >
            {applications.map((application) => (
              <option key={application.id} value={application.cohort.id}>
                {application.cohort.name} · {statusLabel(application.status)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mt-2 text-sm text-muted">Когорта появится после подачи заявки.</p>
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
                id={`application-form-${cohort.id}`}
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

                    <p className="text-xs text-muted">Черновик сохраняется автоматически.</p>

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

function StudentApplications({
  applications,
  onEdit
}: {
  applications: Application[];
  onEdit: (application: Application) => void;
}) {
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
                  <p className="mt-1 text-xs text-muted">
                    Обновлена: {formatDateTime(application.updatedAt)}
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
              {application.status === "PENDING" && !isCohortClosed(application.cohort) ? (
                <Button type="button" variant="secondary" className="mt-3" onClick={() => onEdit(application)}>
                  Изменить заявку
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function StudentTasks({
  applications,
  selectedApplication,
  approvedApplication,
  selectedCohortId,
  currentUserId,
  onCohortChange,
  onApplicationUpdated
}: {
  applications: Application[];
  selectedApplication: Application | null;
  approvedApplication: Application | null;
  selectedCohortId: string;
  currentUserId: string;
  onCohortChange: (cohortId: string) => void;
  onApplicationUpdated: (application: Application) => void;
}) {
  return (
    <div className="grid gap-4">
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] sm:items-end">
          <div>
            <h2 className="text-lg font-semibold">Тестовое задание</h2>
            <p className="mt-1 text-sm text-muted">
              Выполните задание для выбранной когорты и отправьте результат на проверку.
            </p>
          </div>
          {applications.length > 1 ? (
            <label className="grid gap-2 text-sm font-medium">
              Когорта
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={selectedCohortId}
                onChange={(event) => onCohortChange(event.target.value)}
              >
                {applications.map((application) => (
                  <option key={application.id} value={application.cohort.id}>
                    {application.cohort.name} · {statusLabel(application.status)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4">
          {!selectedApplication ? (
            <p className="text-sm text-muted">
              Тестовое задание появится здесь после подачи заявки.
            </p>
          ) : selectedApplication.cohort.testTask?.publishedAt ? (
              <section className="rounded-md border border-border bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{selectedApplication.cohort.name}</h3>
                    <p className="mt-1 text-xs text-muted">Заявка: {statusLabel(selectedApplication.status)}</p>
                  </div>
                  {selectedApplication.testTaskSubmittedAt ? (
                    <span className="rounded-md bg-primarySoft px-2 py-1 text-xs font-medium text-primary">
                      {testTaskReviewLabel(selectedApplication.testTaskReviewStatus)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{selectedApplication.cohort.testTask.content}</p>
                <TestTaskSubmission
                  key={selectedApplication.id}
                  application={selectedApplication}
                  onUpdated={onApplicationUpdated}
                  showStatus={false}
                />
              </section>
          ) : (
            <p className="text-sm text-muted">Для выбранной когорты тестовое задание ещё не опубликовано.</p>
          )}
        </div>
      </Card>

      {approvedApplication ? (
        <TaskBoard cohortId={approvedApplication.cohort.id} currentUserId={currentUserId} />
      ) : (
        <UnavailableSection text="Рабочие задачи станут доступны после одобрения заявки и тестового задания." />
      )}
    </div>
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
      {showCreateForm ? <Card className="order-2 p-5">
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
        <CohortRow
          key={selectedCohort.id}
          cohort={selectedCohort}
          cohorts={cohorts}
          selectedCohortId={selectedCohort.id}
          showCreateForm={showCreateForm}
          onSelectCohort={setSelectedCohortId}
          onToggleCreate={() => setShowCreateForm((current) => !current)}
          onSaved={onCohortChange}
        />
      ) : (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-muted">Создайте первую когорту, чтобы открыть рабочие разделы.</p>
          {!showCreateForm ? (
            <Button type="button" onClick={() => setShowCreateForm(true)}>
              <Plus className="mr-2 h-4 w-4" />Новая когорта
            </Button>
          ) : null}
        </Card>
      )}
    </div>
  );
}

function CohortRow({
  cohort,
  cohorts,
  selectedCohortId,
  showCreateForm,
  onSelectCohort,
  onToggleCreate,
  onSaved
}: {
  cohort: Cohort;
  cohorts: Cohort[];
  selectedCohortId: string;
  showCreateForm: boolean;
  onSelectCohort: (cohortId: string) => void;
  onToggleCreate: () => void;
  onSaved: () => Promise<void>;
}) {
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
  const [taskMessage, setTaskMessage] = useState<string | null>(null);
  const [changingCompletion, setChangingCompletion] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function exportCohort() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadApiFile(`/admin/cohorts/${cohort.id}/export.csv`, `Когорта ${cohort.name}.csv`);
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : "Не удалось выгрузить данные когорты");
    } finally {
      setExporting(false);
    }
  }

  async function toggleCompletion() {
    const completed = !cohort.completedAt;
    if (completed && !window.confirm("Завершить практику? Участники больше не смогут изменять задачи.")) return;
    setChangingCompletion(true);
    setCompletionError(null);
    try {
      await setCohortCompletion(cohort.id, completed);
      await onSaved();
    } catch (caught) {
      setCompletionError(caught instanceof Error ? caught.message : "Не получилось изменить статус когорты");
    } finally {
      setChangingCompletion(false);
    }
  }

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
      setSettingsMessage(result.warning ?? "Настройки анкеты и ролей сохранены");
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Не получилось сохранить анкету и роли");
    } finally {
      setSavingSettings(false);
    }
  }

  async function onSaveTask() {
    setSavingTask(true);
    setTaskError(null);
    setTaskMessage(null);

    try {
      const result = await updateTestTask(cohort.id, content, published);
      if (!result.notification) {
        setTaskMessage("Тестовое задание сохранено");
      } else if (result.notification.recipients === 0) {
        setTaskMessage("Тестовое задание опубликовано. Получателей пока нет");
      } else if (result.notification.sent === result.notification.recipients) {
        setTaskMessage(`Тестовое задание отправлено на почту: ${result.notification.sent}`);
      } else if (!result.notification.configured) {
        setTaskError("Тестовое задание опубликовано, но SMTP не настроен и письма не отправлены");
      } else {
        setTaskError(`Тестовое задание опубликовано, но отправлено писем: ${result.notification.sent} из ${result.notification.recipients}`);
      }
      await onSaved();
    } catch (caught) {
      setTaskError(caught instanceof Error ? caught.message : "Не получилось сохранить тестовое задание");
    } finally {
      setSavingTask(false);
    }
  }

  return (
    <section className="order-1 grid gap-4">
      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
          <label className="grid min-w-60 flex-1 gap-2 text-sm font-medium md:max-w-xl">
            Рабочая когорта
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={selectedCohortId}
              onChange={(event) => onSelectCohort(event.target.value)}
            >
              {cohorts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.completedAt ? " (завершена)" : ""}
                </option>
              ))}
            </select>
          </label>
          <Button className="w-full sm:w-auto" type="button" variant="secondary" onClick={onToggleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {showCreateForm ? "Закрыть создание" : "Новая когорта"}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 border-t border-border pt-4 lg:flex lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <span className="rounded-md bg-primarySoft px-2 py-1 text-xs font-medium text-primary">
              {cohort.completedAt ? "Практика завершена" : cohort.testTask?.publishedAt ? "ТЗ опубликовано" : "ТЗ не опубликовано"}
            </span>
            <span>{cohort.surveyFields.length} полей анкеты · {cohort.roles.length} ролей</span>
            <span>Заявки: {formatDate(cohort.applicationStart)} - {formatDate(cohort.applicationEnd)}</span>
            <span>Практика: {formatDate(cohort.practiceStart)} - {formatDate(cohort.practiceEnd)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button className="col-span-2 w-full sm:col-auto sm:w-auto" type="button" variant="secondary" disabled={exporting} onClick={exportCohort}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Готовим..." : "Экспорт CSV"}
            </Button>
            <Button className="w-full sm:w-auto" type="button" variant="secondary" disabled={changingCompletion} onClick={toggleCompletion}>
              {cohort.completedAt ? <RotateCcw className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
              {cohort.completedAt ? "Возобновить" : "Завершить"}
            </Button>
            <Button className="w-full sm:w-auto" asChild type="button" variant="secondary">
              <a href={`/apply/${cohort.id}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />Публичная анкета
              </a>
            </Button>
          </div>
        </div>
        {completionError ? <p className="mt-3 text-sm text-red-700" role="alert">{completionError}</p> : null}
        {exportError ? <p className="mt-3 text-sm text-red-700" role="alert">{exportError}</p> : null}
      </Card>

      {!showCreateForm ? <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
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
          {activeTab === "tasks" ? (
            <div className="grid gap-4">
              <Card className="p-5">
                <h3 className="text-base font-semibold">Тестовое задание</h3>
                <p className="mt-1 text-sm text-muted">
                  Опубликуйте входное задание, которое студенты выполнят до одобрения заявки.
                </p>
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
                  {taskMessage ? <p className="text-sm text-green-700">{taskMessage}</p> : null}
                  <Button type="button" disabled={savingTask || !content.trim()} onClick={onSaveTask}>
                    {savingTask ? "Сохраняем..." : "Сохранить тестовое задание"}
                  </Button>
                </div>
              </Card>
              <TaskBoard cohortId={cohort.id} currentUserId="" isAdmin />
            </div>
          ) : null}

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

        </Card>
          ) : null}
        </div>
      </div> : null}
    </section>
  );
}

function TestTaskSubmission({
  application,
  onUpdated,
  showStatus = true
}: {
  application: Application;
  onUpdated: (application: Application) => void;
  showStatus?: boolean;
}) {
  const initialDraft = getTestTaskDraft(application.id);
  const [answer, setAnswer] = useState(application.testTaskAnswer ?? initialDraft.answer);
  const [artifactLink, setArtifactLink] = useState(application.testTaskArtifactLink ?? initialDraft.artifactLink);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const editable = application.status !== "REJECTED"
    && application.status !== "REMOVED"
    && !isCohortClosed(application.cohort)
    && application.testTaskReviewStatus !== "APPROVED";

  async function saveAnswer() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await saveTestTaskAnswer(application.id, answer, artifactLink);
      clearTestTaskDraft(application.id);
      onUpdated(result.application);
      setMessage("Ответ отправлен на проверку");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось отправить ответ");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile() {
    if (!file) {
      setError("Выберите файл ответа");
      return;
    }
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await uploadTestTaskFile(application.id, file);
      onUpdated(result.application);
      setFile(null);
      setMessage("Файл загружен и отправлен на проверку");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось загрузить файл");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-3 grid gap-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Ответ на тестовое задание</p>
        {showStatus && application.testTaskSubmittedAt ? (
          <span className="rounded-md bg-primarySoft px-2 py-1 text-xs font-medium text-primary">
            {testTaskReviewLabel(application.testTaskReviewStatus)}
          </span>
        ) : null}
      </div>

      {application.testTaskReviewComment ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Комментарий проверяющего: {application.testTaskReviewComment}
        </p>
      ) : null}

      <TextAreaField
        label="Текст ответа"
        value={answer}
        rows={4}
        onChange={(value) => {
          setAnswer(value);
          saveTestTaskDraft(application.id, { answer: value, artifactLink });
        }}
      />
      <label className="grid gap-2 text-sm font-medium">
        Ссылка на результат
        <Input
          type="url"
          placeholder="https://github.com/..."
          value={artifactLink}
          onChange={(event) => {
            const value = event.target.value;
            setArtifactLink(value);
            saveTestTaskDraft(application.id, { answer, artifactLink: value });
          }}
        />
      </label>

      <Button type="button" disabled={!editable || saving} onClick={saveAnswer}>
        {saving ? "Отправляем..." : application.testTaskSubmittedAt ? "Обновить ответ" : "Отправить ответ"}
      </Button>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={!editable}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <Button type="button" variant="secondary" disabled={!editable || uploading || !file} onClick={uploadFile}>
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? "Загружаем..." : "Загрузить файл"}
        </Button>
      </div>

      {application.testTaskFileName ? (
        <Button
          className="justify-self-start"
          type="button"
          variant="secondary"
          onClick={() => downloadApiFile(`/applications/${application.id}/test-task-file`, application.testTaskFileName ?? "Ответ")}
        >
          <Download className="mr-2 h-4 w-4" />{application.testTaskFileName}
        </Button>
      ) : null}

      {!editable && application.testTaskReviewStatus === "APPROVED" ? (
        <p className="text-sm text-green-700">Ответ одобрен. Редактирование закрыто.</p>
      ) : null}
      <InlineFeedback error={error} message={message} />
    </div>
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
      <div className={sidebar ? "grid grid-cols-5 p-1.5 lg:flex lg:flex-col" : "flex min-w-max gap-1"}>
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
              <span className="whitespace-nowrap text-[10px] sm:text-xs lg:text-sm">{item.label}</span>
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

  async function removeParticipant(application: AdminApplication) {
    if (!window.confirm("Исключить участника из когорты? История заявки сохранится.")) return;
    await changeStatus(application, "REMOVED", undefined, "Исключён из когорты администратором");
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
      setMessage(status === "APPROVED" ? "Заявка одобрена" : status === "REMOVED" ? "Участник исключён из когорты" : "Заявка отклонена");
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
            <option value="REMOVED">Исключена</option>
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
        const hasRoles = cohort.roles.length > 0;
        const testTaskReady = !cohort.testTask?.publishedAt || application.testTaskReviewStatus === "APPROVED";
        const canApprove = hasRoles && testTaskReady;
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

                {cohort.testTask?.publishedAt ? (
                  <AdminTestTaskReview
                    application={application}
                    onUpdated={(updated) => {
                      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
                      setMessage("Статус ответа на тестовое задание обновлён");
                    }}
                  />
                ) : null}

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
                {!hasRoles ? <p className="text-sm text-red-700">Сначала добавьте роли в настройках когорты.</p> : null}
                {hasRoles && !testTaskReady ? (
                  <p className="text-sm text-red-700">Сначала проверьте и одобрите ответ на тестовое задание.</p>
                ) : null}

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
                {application.status === "APPROVED" ? (
                  <Button type="button" variant="secondary" disabled={isSaving} onClick={() => removeParticipant(application)}>
                    <UserMinus className="mr-2 h-4 w-4" />Исключить из когорты
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function AdminTestTaskReview({
  application,
  onUpdated
}: {
  application: AdminApplication;
  onUpdated: (application: AdminApplication) => void;
}) {
  const [comment, setComment] = useState(application.testTaskReviewComment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(status: "APPROVED" | "CHANGES_REQUESTED") {
    setSaving(true);
    setError(null);
    try {
      const result = await reviewTestTaskAnswer(application.id, status, comment);
      onUpdated(result.application);
      if (status === "APPROVED") setComment("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось проверить ответ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-md border border-border bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Ответ на тестовое задание</p>
        {application.testTaskSubmittedAt ? (
          <span className="rounded-md bg-primarySoft px-2 py-1 text-xs font-medium text-primary">
            {testTaskReviewLabel(application.testTaskReviewStatus)}
          </span>
        ) : null}
      </div>

      {!application.testTaskSubmittedAt ? (
        <p className="text-sm text-muted">Студент ещё не отправил ответ.</p>
      ) : (
        <>
          {application.testTaskAnswer ? (
            <p className="whitespace-pre-wrap text-sm">{application.testTaskAnswer}</p>
          ) : null}
          {application.testTaskArtifactLink ? (
            <a
              className="break-all text-sm text-primary underline"
              href={application.testTaskArtifactLink}
              target="_blank"
              rel="noreferrer"
            >
              {application.testTaskArtifactLink}
            </a>
          ) : null}
          {application.testTaskFileName ? (
            <Button
              className="justify-self-start"
              type="button"
              variant="secondary"
              onClick={() => downloadApiFile(
                `/admin/applications/${application.id}/test-task-file`,
                application.testTaskFileName ?? "Ответ"
              )}
            >
              <Download className="mr-2 h-4 w-4" />{application.testTaskFileName}
            </Button>
          ) : null}

          <TextAreaField
            label="Комментарий для исправления"
            value={comment}
            rows={3}
            onChange={setComment}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" disabled={saving} onClick={() => review("APPROVED")}>
              Одобрить ответ
            </Button>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => review("CHANGES_REQUESTED")}>
              Вернуть на исправление
            </Button>
          </div>
          {error ? <InlineFeedback error={error} message={null} /> : null}
        </>
      )}
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
        ...(field.key.startsWith("draft-") ? {} : { id: field.key }),
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

function uniqueCohorts(cohorts: Cohort[]) {
  return [...new Map(cohorts.map((cohort) => [cohort.id, cohort])).values()];
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
    REJECTED: "Отклонена",
    REMOVED: "Исключена"
  };

  return labels[status];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value));
}

function testTaskReviewLabel(status: Application["testTaskReviewStatus"]) {
  if (status === "APPROVED") return "Ответ одобрен";
  if (status === "CHANGES_REQUESTED") return "Нужны исправления";
  return "На проверке";
}

function isCohortClosed(cohort: Pick<Cohort, "practiceEnd" | "completedAt">) {
  if (cohort.completedAt) return true;
  const end = new Date(cohort.practiceEnd);
  const closesAt = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1);
  return Date.now() >= closesAt;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
