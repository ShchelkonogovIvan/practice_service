"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Download, FileText, RotateCcw, Save, X } from "lucide-react";
import {
  AdminDocumentRow,
  Cohort,
  ReportReviewStatus,
  StudentDocumentData,
  downloadApiFile,
  listAdminDocuments,
  saveAdminReview,
  setReportReview
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
  const [comments, setComments] = useState<Record<string, string>>({});
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
      setComments(Object.fromEntries(result.rows.map((row) => [row.user.id, row.data?.reportReviewComment ?? ""])));
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

  async function reviewReport(row: AdminDocumentRow, status: ReportReviewStatus) {
    const comment = status === "PENDING" ? "" : comments[row.user.id]?.trim() ?? "";
    if (status === "CHANGES_REQUESTED" && !comment) {
      setError("Добавьте комментарий с необходимыми исправлениями");
      return;
    }

    setSavingUserId(row.user.id);
    setError(null);
    setMessage(null);
    try {
      await setReportReview(cohort.id, row.user.id, status, comment);
      setMessage(
        status === "APPROVED"
          ? "Отчёт одобрен"
          : status === "CHANGES_REQUESTED"
            ? "Отчёт возвращён на доработку"
            : "Допуск к титульному листу снят"
      );
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
    <div className="grid gap-3 rounded-md border border-border bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Документы когорты</p>
          <p className="mt-1 text-sm text-muted">Одобренных практикантов: {rows.length}</p>
        </div>
        <Button type="button" variant="secondary" onClick={load}>Обновить</Button>
      </div>
      {loading ? <p className="text-sm text-muted">Загрузка...</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {!loading && rows.length === 0 ? <p className="text-sm text-muted">Одобренных заявок пока нет.</p> : null}

      {!loading && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border bg-white">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-3 font-semibold">Практикант</th>
                <th className="px-3 py-3 text-center font-semibold">ИЗ</th>
                <th className="px-3 py-3 text-center font-semibold">Отзыв</th>
                <th className="px-3 py-3 text-center font-semibold">Титульный лист</th>
                <th className="px-3 py-3 font-semibold">Отчёт</th>
                <th className="px-3 py-3 text-right font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const expanded = expandedUserId === row.user.id;
                return (
                  <tr key={row.user.id} className="border-t border-border align-middle">
                    <td className="px-3 py-3">
                      <p className="font-medium">{row.data?.studentFio || row.user.email}</p>
                      <p className="mt-1 text-xs text-muted">{row.role?.name ?? row.user.email}</p>
                    </td>
                    <td className="px-3 py-3 text-center"><Status ready={row.readiness.individualReady} label="ИЗ" compact /></td>
                    <td className="px-3 py-3 text-center"><Status ready={row.readiness.reviewReady} label="Отзыв" compact /></td>
                    <td className="px-3 py-3 text-center"><Status ready={row.readiness.titleReady} label="Титул" compact /></td>
                    <td className="px-3 py-3"><ReportStatus status={row.data?.reportReviewStatus ?? null} uploaded={row.readiness.reportUploaded} /></td>
                    <td className="px-3 py-3 text-right">
                      <Button type="button" variant="secondary" onClick={() => setExpandedUserId(expanded ? null : row.user.id)}>
                        <FileText className="mr-2 h-4 w-4" />{expanded ? "Свернуть" : "Открыть"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {rows.map((row) => {
        const form = forms[row.user.id] ?? emptyReview;
        const expanded = expandedUserId === row.user.id;
        const saving = savingUserId === row.user.id;
        if (!expanded) return null;
        return (
          <div key={row.user.id} className="rounded-md border border-border bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{row.data?.studentFio || row.user.email}</p>
                <p className="mt-1 text-sm text-muted">{row.user.email}{row.role ? ` · ${row.role.name}` : ""}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <Status ready={row.readiness.individualReady} label="ИЗ" />
                  <Status ready={row.readiness.reviewReady} label="Отзыв" />
                  <Status ready={row.readiness.titleReady} label="Титульный лист" />
                  <ReportStatus status={row.data?.reportReviewStatus ?? null} uploaded={row.readiness.reportUploaded} />
                </div>
              </div>
              <Button type="button" variant="secondary" onClick={() => setExpandedUserId(expanded ? null : row.user.id)}>
                <FileText className="mr-2 h-4 w-4" />{expanded ? "Свернуть" : "Документы"}
              </Button>
            </div>

            {expanded ? (
              <div className="mt-4 grid gap-5 border-t border-border pt-4">
                <section className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">Проверка отчёта</p>
                    <Button type="button" variant="secondary" disabled={!row.readiness.reportUploaded} onClick={() => downloadReport(row)}>
                      <Download className="mr-2 h-4 w-4" />Скачать отчёт
                    </Button>
                  </div>
                  <label className="grid gap-2 text-sm font-medium">
                    Комментарий студенту
                    <textarea
                      className="min-h-24 rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="Опишите замечания или оставьте комментарий к одобрению"
                      value={comments[row.user.id] ?? ""}
                      onChange={(event) => setComments((current) => ({ ...current, [row.user.id]: event.target.value }))}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={!row.readiness.reportUploaded || saving} onClick={() => reviewReport(row, "APPROVED")}>
                      <Check className="mr-2 h-4 w-4" />Одобрить
                    </Button>
                    <Button type="button" variant="secondary" disabled={!row.readiness.reportUploaded || saving || !(comments[row.user.id]?.trim())} onClick={() => reviewReport(row, "CHANGES_REQUESTED")}>
                      <AlertTriangle className="mr-2 h-4 w-4" />Вернуть на доработку
                    </Button>
                    {row.data?.reportReviewStatus === "APPROVED" ? (
                      <Button type="button" variant="secondary" disabled={saving} onClick={() => reviewReport(row, "PENDING")}>
                        <RotateCcw className="mr-2 h-4 w-4" />Снять допуск
                      </Button>
                    ) : null}
                  </div>
                </section>

                <section className="grid gap-3 border-t border-border pt-4">
                  <p className="font-medium">Отзыв руководителя</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ReviewField label="Мероприятия за практику" value={form.reviewActivities} onChange={(value) => updateForm(row.user.id, "reviewActivities", value, forms, setForms)} />
                    <ReviewField label="Характеристика подготовки" value={form.reviewCharacteristic} onChange={(value) => updateForm(row.user.id, "reviewCharacteristic", value, forms, setForms)} />
                    <ReviewField label="Трудоустройство во время практики" value={form.reviewEmployed} onChange={(value) => updateForm(row.user.id, "reviewEmployed", value, forms, setForms)} />
                    <ReviewField label="Следующая практика" value={form.reviewNextPractice} onChange={(value) => updateForm(row.user.id, "reviewNextPractice", value, forms, setForms)} />
                    <ReviewField label="Предложение трудоустройства" value={form.reviewEmploymentOffer} onChange={(value) => updateForm(row.user.id, "reviewEmploymentOffer", value, forms, setForms)} />
                    <ReviewField label="Оценка" value={form.reviewGrade} onChange={(value) => updateForm(row.user.id, "reviewGrade", value, forms, setForms)} />
                  </div>
                  <ReviewField label="Предложения и замечания" value={form.reviewSuggestions} onChange={(value) => updateForm(row.user.id, "reviewSuggestions", value, forms, setForms)} />
                  <Button type="button" disabled={saving || Object.values(form).some((value) => !value.trim())} onClick={() => saveReview(row)}>
                    <Save className="mr-2 h-4 w-4" />{saving ? "Сохраняем..." : "Сохранить отзыв"}
                  </Button>
                </section>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Status({ ready, label, compact = false }: { ready: boolean; label: string; compact?: boolean }) {
  return <span className="inline-flex items-center gap-1" title={`${label}: ${ready ? "готово" : "не готово"}`}>{ready ? <Check className="h-4 w-4 text-green-700" /> : <X className="h-4 w-4 text-red-700" />}{compact ? <span className="sr-only">{label}</span> : label}</span>;
}

function ReportStatus({ status, uploaded }: { status: ReportReviewStatus | null; uploaded: boolean }) {
  const label = !uploaded ? "Отчёт не загружен" : status === "APPROVED" ? "Отчёт одобрен" : status === "CHANGES_REQUESTED" ? "Нужны исправления" : "Отчёт на проверке";
  const color = status === "APPROVED" ? "text-green-700" : status === "CHANGES_REQUESTED" ? "text-red-700" : "text-primary";
  return <span className={`font-medium ${color}`}>{label}</span>;
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
