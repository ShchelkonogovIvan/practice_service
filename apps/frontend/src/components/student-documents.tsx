"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Save, Upload } from "lucide-react";
import {
  Application,
  DocumentReadiness,
  StudentDocumentData,
  downloadApiFile,
  myDocumentData,
  saveMyDocumentData,
  uploadPracticeReport
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type FormValues = Record<
  "studentFio" | "group" | "directionCode" | "directionName" | "programName" | "specialty" | "practiceTopic" | "mainStageTasks",
  string
>;

const emptyForm: FormValues = {
  studentFio: "",
  group: "",
  directionCode: "",
  directionName: "",
  programName: "",
  specialty: "",
  practiceTopic: "",
  mainStageTasks: ""
};

const emptyReadiness: DocumentReadiness = {
  individualReady: false,
  reviewReady: false,
  titleReady: false,
  reportUploaded: false,
  reportApproved: false,
  individualReason: null,
  reviewReason: null,
  titleReason: null
};

export function StudentDocuments({ application }: { application: Application }) {
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [data, setData] = useState<StudentDocumentData | null>(null);
  const [readiness, setReadiness] = useState(emptyReadiness);
  const [report, setReport] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackArea, setFeedbackArea] = useState<"load" | "form" | "report" | "documents">("load");
  const lastSavedForm = useRef<FormValues>(emptyForm);

  useEffect(() => {
    load(false);
    const interval = window.setInterval(() => load(true), 10000);
    const refreshOnFocus = () => load(true);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [application.cohort.id]);

  async function load(silent: boolean) {
    try {
      const result = await myDocumentData(application.cohort.id);
      setData(result.data);
      setReadiness(result.readiness);
      if (result.data && !silent) {
        const nextForm = formFromData(result.data);
        setForm(nextForm);
        lastSavedForm.current = nextForm;
      }
      if (!silent) setError(null);
    } catch (caught) {
      if (!silent) {
        setFeedbackArea("load");
        setError(errorMessage(caught));
      }
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    await persistForm(true);
  }

  async function autosave() {
    if (JSON.stringify(form) === JSON.stringify(lastSavedForm.current)) return;
    await persistForm(false);
  }

  async function persistForm(showMessage: boolean) {
    const snapshot = { ...form };
    setSaving(true);
    setFeedbackArea("form");
    setError(null);
    if (showMessage) setMessage(null);
    try {
      const result = await saveMyDocumentData(application.cohort.id, snapshot);
      setData(result.data);
      setReadiness(result.readiness);
      lastSavedForm.current = snapshot;
      setMessage(showMessage ? "Данные документов сохранены" : "Сохранено автоматически");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function uploadReport() {
    if (!report) return;
    setUploading(true);
    setFeedbackArea("report");
    setError(null);
    setMessage(null);
    try {
      const result = await uploadPracticeReport(application.cohort.id, report);
      setData(result.data);
      setReadiness(result.readiness);
      setReport(null);
      setMessage("Отчёт загружен и отправлен администратору");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setUploading(false);
    }
  }

  async function download(path: string, filename: string, area: "report" | "documents" = "documents") {
    setFeedbackArea(area);
    setError(null);
    setMessage(null);
    try {
      await downloadApiFile(path, filename);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const cohortId = application.cohort.id;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Документы</h2>
          <p className="mt-1 text-sm text-muted">Когорта: {application.cohort.name}</p>
        </div>
        <span className="rounded-md bg-primarySoft px-2 py-1 text-xs font-medium text-primary">
          {reportStatusLabel(data?.reportReviewStatus ?? null, readiness.reportUploaded)}
        </span>
      </div>

      {data?.reportReviewComment ? (
        <div className={`mt-4 rounded-md border px-3 py-2 text-sm ${data.reportReviewStatus === "CHANGES_REQUESTED" ? "border-red-200 bg-red-50 text-red-800" : "border-border bg-slate-50 text-foreground"}`}>
          <span className="font-medium">Комментарий администратора:</span> {data.reportReviewComment}
        </div>
      ) : null}

      {feedbackArea === "load" ? (
        <div>
          <FeedbackNotice error={error} message={message} />
          {error ? <Button type="button" variant="secondary" onClick={() => load(false)}>Повторить</Button> : null}
        </div>
      ) : null}

      <form className="mt-5 grid gap-4" onSubmit={save}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="ФИО" value={form.studentFio} onChange={(value) => setForm({ ...form, studentFio: value })} onBlur={autosave} />
          <Field label="Группа" value={form.group} onChange={(value) => setForm({ ...form, group: value })} onBlur={autosave} />
          <Field label="Код направления" value={form.directionCode} onChange={(value) => setForm({ ...form, directionCode: value })} onBlur={autosave} />
          <Field label="Наименование направления" value={form.directionName} onChange={(value) => setForm({ ...form, directionName: value })} onBlur={autosave} />
          <Field label="Образовательная программа" value={form.programName} onChange={(value) => setForm({ ...form, programName: value })} onBlur={autosave} />
          <Field label="Специальность для титульного листа" value={form.specialty} onChange={(value) => setForm({ ...form, specialty: value })} onBlur={autosave} />
        </div>
        <Field label="Тема практики" value={form.practiceTopic} onChange={(value) => setForm({ ...form, practiceTopic: value })} onBlur={autosave} />
        <label className="grid gap-2 text-sm font-medium">
          Работы основного этапа
          <textarea className="min-h-28 rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={form.mainStageTasks} onChange={(event) => setForm({ ...form, mainStageTasks: event.target.value })} onBlur={autosave} />
        </label>
        {feedbackArea === "form" ? <FeedbackNotice error={error} message={message} /> : null}

        <Button type="submit" disabled={saving} onMouseDown={(event) => event.preventDefault()}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Сохраняем..." : "Сохранить данные"}
        </Button>
      </form>

      <div className="mt-6 border-t border-border pt-5">
        <p className="font-medium">Отчёт о практике</p>
        {data?.reportFileName ? (
          <p className="mt-2 text-sm text-muted">
            {data.reportFileName}{data.reportUploadedAt ? ` · ${formatDate(data.reportUploadedAt)}` : ""}
          </p>
        ) : null}
        {feedbackArea === "report" ? <FeedbackNotice error={error} message={message} /> : null}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Input className="max-w-md" accept=".docx,.pdf" type="file" onChange={(event) => setReport(event.target.files?.[0] ?? null)} />
          <Button type="button" disabled={!report || uploading} onClick={uploadReport}>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Загружаем..." : "Загрузить"}
          </Button>
          {readiness.reportUploaded ? (
            <Button type="button" variant="secondary" onClick={() => download(`/cohorts/${cohortId}/documents/me/report`, data?.reportFileName ?? "practice-report", "report")}>
              <Download className="mr-2 h-4 w-4" />
              Скачать отчёт
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        {feedbackArea === "documents" ? <FeedbackNotice error={error} message={message} /> : null}
        <div className="grid gap-3 md:grid-cols-3">
          <DocumentButton label="Сформировать ИЗ" enabled={readiness.individualReady} reason={readiness.individualReason} onClick={() => download(`/cohorts/${cohortId}/documents/me/generate/individual-assignment`, "individual-assignment.docx")} />
          <DocumentButton label="Сформировать отзыв" enabled={readiness.reviewReady} reason={readiness.reviewReason} onClick={() => download(`/cohorts/${cohortId}/documents/me/generate/review`, "practice-review.docx")} />
          <DocumentButton label="Сформировать титульный лист" enabled={readiness.titleReady} reason={readiness.titleReason} onClick={() => download(`/cohorts/${cohortId}/documents/me/generate/title-page`, "report-title-page.docx")} />
        </div>
      </div>
    </Card>
  );
}

function Field({ label, value, onChange, onBlur }: { label: string; value: string; onChange: (value: string) => void; onBlur?: () => void }) {
  return <label className="grid gap-2 text-sm font-medium">{label}<Input value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} /></label>;
}

function DocumentButton({ label, enabled, reason, onClick }: { label: string; enabled: boolean; reason: string | null; onClick: () => void }) {
  return <div className="grid content-start gap-2"><Button type="button" variant={enabled ? "primary" : "secondary"} disabled={!enabled} onClick={onClick}><Download className="mr-2 h-4 w-4" />{label}</Button>{!enabled && reason ? <p className="text-xs text-muted">{reason}</p> : null}</div>;
}

function FeedbackNotice({ error, message }: { error: string | null; message: string | null }) {
  if (error) {
    return <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">{error}</div>;
  }
  if (message) {
    return <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700" role="status">{message}</div>;
  }
  return null;
}

function formFromData(data: StudentDocumentData): FormValues {
  return Object.fromEntries(Object.keys(emptyForm).map((key) => [key, data[key as keyof FormValues] ?? ""])) as FormValues;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function errorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : "Не удалось выполнить действие";
}

function reportStatusLabel(status: StudentDocumentData["reportReviewStatus"], uploaded: boolean) {
  if (!uploaded) return "Отчёт не загружен";
  if (status === "APPROVED") return "Отчёт одобрен";
  if (status === "CHANGES_REQUESTED") return "Требуются исправления";
  return "Отчёт на проверке";
}
