"use client";

import { useEffect, useState } from "react";
import { Check, Download, FileText, Save, X } from "lucide-react";
import {
  AdminDocumentRow,
  Cohort,
  StudentDocumentData,
  downloadApiFile,
  listAdminDocuments,
  saveAdminReview,
  setReportApproval
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ReviewForm = Record<
  "reviewActivities" | "reviewCharacteristic" | "reviewEmployed" | "reviewNextPractice" | "reviewEmploymentOffer" | "reviewSuggestions" | "reviewGrade",
  string
>;

const emptyReview: ReviewForm = {
  reviewActivities: "",
  reviewCharacteristic: "",
  reviewEmployed: "",
  reviewNextPractice: "",
  reviewEmploymentOffer: "",
  reviewSuggestions: "",
  reviewGrade: ""
};

export function AdminDocumentsPanel({ cohort }: { cohort: Cohort }) {
  const [rows, setRows] = useState<AdminDocumentRow[]>([]);
  const [forms, setForms] = useState<Record<string, ReviewForm>>({});
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { load(); }, [cohort.id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminDocuments(cohort.id);
      setRows(result.rows);
      setForms(Object.fromEntries(result.rows.map((row) => [row.user.id, reviewFromData(row.data)])));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function saveReview(row: AdminDocumentRow) {
    setSavingUserId(row.user.id);
    setError(null);
    setMessage(null);
    try {
      await saveAdminReview(cohort.id, row.user.id, forms[row.user.id] ?? emptyReview);
      setMessage("Отзыв сохранён");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSavingUserId(null);
    }
  }

  async function approve(row: AdminDocumentRow, approved: boolean) {
    setSavingUserId(row.user.id);
    setError(null);
    try {
      await setReportApproval(cohort.id, row.user.id, approved);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSavingUserId(null);
    }
  }

  async function downloadReport(row: AdminDocumentRow) {
    try {
      await downloadApiFile(`/admin/cohorts/${cohort.id}/documents/${row.user.id}/report`, row.data?.reportFileName ?? "practice-report");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <div className="mt-3 grid gap-3 rounded-md border border-border bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-medium">Документы когорты</p><p className="mt-1 text-sm text-muted">Одобренных практикантов: {rows.length}</p></div>
        <Button type="button" variant="secondary" onClick={load}>Обновить</Button>
      </div>
      {loading ? <p className="text-sm text-muted">Загрузка...</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {!loading && rows.length === 0 ? <p className="text-sm text-muted">Одобренных заявок пока нет.</p> : null}

      {rows.map((row) => {
        const form = forms[row.user.id] ?? emptyReview;
        const expanded = expandedUserId === row.user.id;
        const saving = savingUserId === row.user.id;
        return (
          <div key={row.user.id} className="rounded-md border border-border bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.data?.studentFio || row.user.email}</p>
                <p className="mt-1 text-sm text-muted">{row.user.email}{row.role ? ` · ${row.role.name}` : ""}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                  <Status ready={row.readiness.individualReady} label="ИЗ" />
                  <Status ready={row.readiness.reviewReady} label="Отзыв" />
                  <Status ready={row.readiness.titleReady} label="Титульный лист" />
                </div>
              </div>
              <Button type="button" variant="secondary" onClick={() => setExpandedUserId(expanded ? null : row.user.id)}>
                <FileText className="mr-2 h-4 w-4" />{expanded ? "Свернуть" : "Документы"}
              </Button>
            </div>

            {expanded ? (
              <div className="mt-4 grid gap-4 border-t border-border pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="secondary" disabled={!row.readiness.reportUploaded} onClick={() => downloadReport(row)}><Download className="mr-2 h-4 w-4" />Открыть отчёт</Button>
                  <Button type="button" disabled={!row.readiness.reportUploaded || saving} onClick={() => approve(row, !row.readiness.reportApproved)}>
                    {row.readiness.reportApproved ? <X className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                    {row.readiness.reportApproved ? "Снять допуск" : "Допустить титульный лист"}
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <ReviewField label="Мероприятия за практику" value={form.reviewActivities} onChange={(value) => updateForm(row.user.id, "reviewActivities", value, forms, setForms)} />
                  <ReviewField label="Характеристика подготовки" value={form.reviewCharacteristic} onChange={(value) => updateForm(row.user.id, "reviewCharacteristic", value, forms, setForms)} />
                  <ReviewField label="Трудоустройство во время практики" value={form.reviewEmployed} onChange={(value) => updateForm(row.user.id, "reviewEmployed", value, forms, setForms)} />
                  <ReviewField label="Следующая практика" value={form.reviewNextPractice} onChange={(value) => updateForm(row.user.id, "reviewNextPractice", value, forms, setForms)} />
                  <ReviewField label="Предложение трудоустройства" value={form.reviewEmploymentOffer} onChange={(value) => updateForm(row.user.id, "reviewEmploymentOffer", value, forms, setForms)} />
                  <ReviewField label="Оценка" value={form.reviewGrade} onChange={(value) => updateForm(row.user.id, "reviewGrade", value, forms, setForms)} />
                </div>
                <ReviewField label="Предложения и замечания" value={form.reviewSuggestions} onChange={(value) => updateForm(row.user.id, "reviewSuggestions", value, forms, setForms)} />
                <Button type="button" disabled={saving || Object.values(form).some((value) => !value.trim())} onClick={() => saveReview(row)}><Save className="mr-2 h-4 w-4" />{saving ? "Сохраняем..." : "Сохранить отзыв"}</Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Status({ ready, label }: { ready: boolean; label: string }) {
  return <span className="inline-flex items-center gap-1">{ready ? <Check className="h-3.5 w-3.5 text-green-700" /> : <X className="h-3.5 w-3.5 text-red-700" />}{label}</span>;
}

function ReviewField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm font-medium">{label}<Input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function updateForm(userId: string, field: keyof ReviewForm, value: string, forms: Record<string, ReviewForm>, setForms: React.Dispatch<React.SetStateAction<Record<string, ReviewForm>>>) {
  setForms({ ...forms, [userId]: { ...(forms[userId] ?? emptyReview), [field]: value } });
}

function reviewFromData(data: StudentDocumentData | null): ReviewForm {
  return Object.fromEntries(Object.keys(emptyReview).map((key) => [key, data?.[key as keyof ReviewForm] ?? ""])) as ReviewForm;
}

function errorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : "Не удалось выполнить действие";
}
