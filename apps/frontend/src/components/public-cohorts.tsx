"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { activeCohort, Cohort, getToken, publicCohort, savePendingApplication, submitApplication } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Answers = Record<string, string>;
type AnswersByCohort = Record<string, Answers>;

export function PublicCohorts({ cohortId }: { cohortId?: string }) {
  const router = useRouter();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [answersByCohort, setAnswersByCohort] = useState<AnswersByCohort>({});
  const [expandedCohortId, setExpandedCohortId] = useState<string | null>(null);
  const [submittingCohortId, setSubmittingCohortId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const request = cohortId
      ? publicCohort(cohortId).then((result) => [result.cohort])
      : activeCohort().then((result) => result.cohorts ?? (result.cohort ? [result.cohort] : []));

    request
      .then(setCohorts)
      .catch((caught) => setLoadError(caught instanceof Error ? caught.message : "Не удалось загрузить когорты"))
      .finally(() => setLoading(false));
  }, [cohortId]);

  function setAnswer(cohortId: string, fieldId: string, value: string) {
    setAnswersByCohort((current) => ({
      ...current,
      [cohortId]: {
        ...(current[cohortId] ?? {}),
        [fieldId]: value
      }
    }));
  }

  async function onSubmit(event: React.FormEvent, cohort: Cohort) {
    event.preventDefault();

    const answers = answersByCohort[cohort.id] ?? {};
    const missingField = cohort.surveyFields.find((field) => field.required && !answers[field.id]?.trim());

    if (missingField) {
      setError(`Заполните поле "${missingField.label}"`);
      return;
    }

    setError(null);

    if (!getToken()) {
      savePendingApplication({ cohortId: cohort.id, answers });
      router.push("/auth");
      return;
    }

    setSubmittingCohortId(cohort.id);

    try {
      await submitApplication(cohort.id, answers);
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не получилось отправить заявку");
    } finally {
      setSubmittingCohortId(null);
    }
  }

  return (
    <section className="mt-5 grid gap-4">
      <h2 className="text-xl font-semibold">Открытые когорты</h2>

      {loading ? <Card className="p-5 text-sm text-muted">Загрузка...</Card> : null}

      {loadError ? (
        <Card className="border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">{loadError}</Card>
      ) : null}

      {!loading && !loadError && cohorts.length === 0 ? (
        <Card className="p-5 text-sm text-muted">Сейчас нет открытых наборов на практику.</Card>
      ) : null}

      {cohorts.map((cohort) => {
        const answers = answersByCohort[cohort.id] ?? {};
        const isExpanded = expandedCohortId === cohort.id;
        const isSubmitting = submittingCohortId === cohort.id;

        return (
          <Card key={cohort.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{cohort.name}</h3>
                <p className="mt-2 text-sm text-muted">
                  Прием заявок: {formatDate(cohort.applicationStart)} - {formatDate(cohort.applicationEnd)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Практика: {formatDate(cohort.practiceStart)} - {formatDate(cohort.practiceEnd)}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  setError(null);
                  setExpandedCohortId((current) => (current === cohort.id ? null : cohort.id));
                }}
              >
                {isExpanded ? "Свернуть анкету" : "Заполнить анкету"}
              </Button>
              {!cohortId ? (
                <Button asChild type="button" variant="secondary">
                  <Link href={`/apply/${cohort.id}`}>Открыть по ссылке</Link>
                </Button>
              ) : null}
            </div>

            {isExpanded ? (
              <form className="mt-4 grid gap-4" onSubmit={(event) => onSubmit(event, cohort)}>
                {cohort.surveyFields.length === 0 ? (
                  <p className="text-sm text-muted">Поля анкеты пока не добавлены.</p>
                ) : (
                  cohort.surveyFields.map((field) => (
                    <SurveyFieldControl
                      key={field.id}
                      field={field}
                      value={answers[field.id] ?? ""}
                      onChange={(value) => setAnswer(cohort.id, field.id, value)}
                    />
                  ))
                )}

                {error ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
                    {error}
                  </div>
                ) : null}

                <Button type="submit" disabled={isSubmitting || cohort.surveyFields.length === 0}>
                  {isSubmitting ? "Отправляем..." : "Отправить"}
                </Button>
                <p className="text-xs leading-5 text-muted">
                  Если вы еще не авторизованы, данные анкеты временно сохранятся. После регистрации или входа заявка
                  отправится автоматически.
                </p>
              </form>
            ) : null}
          </Card>
        );
      })}
    </section>
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
      <label className="grid gap-2 text-sm font-medium">
        {field.label}
        <textarea
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
          required={field.required}
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }

  return (
    <label className="grid gap-2 text-sm font-medium">
      {field.label}
      <Input required={field.required} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function getStringOptions(value: unknown) {
  return Array.isArray(value) ? value.filter((option): option is string => typeof option === "string") : [];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value));
}
