"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Plus,
  Users,
  X
} from "lucide-react";
import {
  createTaskCard,
  getTaskBoard,
  TaskBoard as TaskBoardData,
  TaskCard,
  TaskCardValues,
  TaskParticipant,
  updateTaskCard
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const emptyValues: TaskCardValues = {
  title: "",
  description: "",
  doneText: "",
  artifactLink: ""
};

type EditorState = {
  date: string;
  participant: TaskParticipant;
  card?: TaskCard;
  readOnly: boolean;
};

export function TaskBoard({
  cohortId,
  currentUserId,
  isAdmin = false,
  embedded = false
}: {
  cohortId: string;
  currentUserId: string;
  isAdmin?: boolean;
  embedded?: boolean;
}) {
  const [board, setBoard] = useState<TaskBoardData | null>(null);
  const [showAll, setShowAll] = useState(isAdmin);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [values, setValues] = useState<TaskCardValues>(emptyValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    loadBoard();
  }, [cohortId, showAll]);

  async function loadBoard() {
    setLoading(true);
    setError(null);
    try {
      const result = await getTaskBoard(cohortId, isAdmin || showAll);
      setBoard(result);
      const availableWeeks = buildWeekStarts(result.cohort.practiceStart, result.cohort.practiceEnd);
      setSelectedWeek((current) =>
        current && availableWeeks.includes(current)
          ? current
          : defaultWeek(result.cohort.practiceStart, result.cohort.practiceEnd)
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось загрузить задачи");
    } finally {
      setLoading(false);
    }
  }

  function openNewCard(participant: TaskParticipant, date: string) {
    setValues(emptyValues);
    setEditorError(null);
    setEditor({ date, participant, readOnly: false });
  }

  function openExistingCard(participant: TaskParticipant, card: TaskCard) {
    setValues({
      title: card.title,
      description: card.description ?? "",
      doneText: card.doneText ?? "",
      artifactLink: card.artifactLink ?? ""
    });
    setEditorError(null);
    setEditor({
      date: dateKey(card.date),
      participant,
      card,
      readOnly: Boolean(board?.cohort.completedAt) || isAdmin || participant.userId !== currentUserId
    });
  }

  async function saveCard(event: React.FormEvent) {
    event.preventDefault();
    if (!editor || editor.readOnly) {
      return;
    }

    setSaving(true);
    setEditorError(null);
    try {
      if (editor.card) {
        await updateTaskCard(editor.card.id, values);
      } else {
        await createTaskCard(cohortId, editor.date, values);
      }
      setEditor(null);
      await loadBoard();
    } catch (caught) {
      setEditorError(caught instanceof Error ? caught.message : "Не удалось сохранить карточку");
    } finally {
      setSaving(false);
    }
  }

  const weeks = useMemo(
    () => (board ? buildWeekStarts(board.cohort.practiceStart, board.cohort.practiceEnd) : []),
    [board]
  );
  const weekIndex = Math.max(0, weeks.indexOf(selectedWeek ?? ""));
  const activeWeek = weeks[weekIndex] ?? null;
  const days = board && activeWeek
    ? workingDays(activeWeek, board.cohort.practiceStart, board.cohort.practiceEnd)
    : [];
  const gridTemplateColumns = `minmax(190px, 0.9fr) repeat(${Math.max(days.length, 1)}, minmax(145px, 1fr))`;

  return (
    <section
      className={
        embedded
          ? "mt-4 border-t border-border pt-4"
          : "rounded-lg border border-border bg-white p-4 shadow-panel sm:p-5"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Задачи и прогресс</h2>
          <p className="mt-1 text-sm text-muted">
            {board ? `${board.cohort.name} · ${formatPeriod(board.cohort.practiceStart, board.cohort.practiceEnd)}` : "Недельная сетка практики"}
          </p>
        </div>

        {!isAdmin ? (
          <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium">
            <Users className="h-4 w-4 text-muted" />
            <input
              type="checkbox"
              checked={showAll}
              onChange={(event) => setShowAll(event.target.checked)}
            />
            Показать всех
          </label>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 border-y border-border py-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-10 w-10 p-0"
            title="Предыдущая неделя"
            aria-label="Предыдущая неделя"
            disabled={weekIndex <= 0}
            onClick={() => setSelectedWeek(weeks[weekIndex - 1])}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-10 w-10 p-0 sm:w-auto sm:px-4"
            title="Текущая неделя"
            aria-label="Текущая неделя"
            onClick={() => board && setSelectedWeek(defaultWeek(board.cohort.practiceStart, board.cohort.practiceEnd))}
          >
            <CalendarDays className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Текущая неделя</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-10 w-10 p-0"
            title="Следующая неделя"
            aria-label="Следующая неделя"
            disabled={weekIndex >= weeks.length - 1}
            onClick={() => setSelectedWeek(weeks[weekIndex + 1])}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-center text-sm font-medium sm:text-left">{days.length ? formatWeek(days) : "Нет рабочих дней"}</p>
      </div>

      {error ? (
        <div className="mt-4 flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm text-red-700">{error}</p>
          <Button type="button" variant="secondary" onClick={loadBoard}>Повторить</Button>
        </div>
      ) : null}
      {board?.cohort.completedAt ? (
        <p className="rounded-md border border-border bg-slate-50 px-3 py-2 text-sm text-muted">
          Практика завершена. Задачи доступны только для просмотра.
        </p>
      ) : null}
      {loading ? <p className="mt-4 text-sm text-muted">Загрузка задач...</p> : null}

      {!loading && board && board.participants.length === 0 ? (
        <p className="mt-4 text-sm text-muted">В этой когорте пока нет одобренных участников.</p>
      ) : null}

      {!loading && board && board.participants.length > 0 && days.length > 0 ? (
        <div className="mt-4 grid gap-4 md:hidden">
          {board.participants.map((participant) => {
            const canEdit = !board.cohort.completedAt && !isAdmin && participant.userId === currentUserId;
            return (
              <section key={participant.userId} className="overflow-hidden rounded-md border border-border bg-white">
                <div className="bg-slate-50 px-3 py-3">
                  <p className="break-words text-sm font-semibold">{participant.displayName}</p>
                  <p className="mt-1 text-xs text-muted">{participant.role?.name ?? "Роль не назначена"}</p>
                </div>
                {days.map((day) => {
                  const cards = participant.cards.filter((card) => dateKey(card.date) === day);
                  return (
                    <div key={day} className="border-t border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted">{weekdayLabel(day)}</p>
                          <p className="mt-1 text-sm font-medium">{formatShortDate(day)}</p>
                        </div>
                        {canEdit ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-9 w-9 shrink-0 p-0"
                            title={`Добавить задачу на ${formatShortDate(day)}`}
                            aria-label={`Добавить задачу на ${formatShortDate(day)}`}
                            onClick={() => openNewCard(participant, day)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-2">
                        {cards.map((card) => (
                          <TaskCardItem key={card.id} card={card} onOpen={() => openExistingCard(participant, card)} />
                        ))}
                        {cards.length === 0 ? <p className="text-xs text-muted">Нет записей</p> : null}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      ) : null}

      {!loading && board && board.participants.length > 0 && days.length > 0 ? (
        <div className="mt-4 hidden overflow-x-auto rounded-md border border-border md:block">
          <div className="min-w-[920px]">
            <div className="grid bg-slate-50" style={{ gridTemplateColumns }}>
              <div className="p-3 text-xs font-semibold uppercase text-muted">Участник</div>
              {days.map((day) => (
                <div key={day} className="border-l border-border p-3 text-center">
                  <p className="text-xs font-semibold uppercase text-muted">{weekdayLabel(day)}</p>
                  <p className="mt-1 text-sm font-medium">{formatShortDate(day)}</p>
                </div>
              ))}
            </div>

            {board.participants.map((participant) => {
              const canEdit = !board.cohort.completedAt && !isAdmin && participant.userId === currentUserId;
              return (
                <div
                  key={participant.userId}
                  className="grid border-t border-border"
                  style={{ gridTemplateColumns }}
                >
                  <div className="min-w-0 bg-slate-50/60 p-3">
                    <p className="break-words text-sm font-medium">{participant.displayName}</p>
                    <p className="mt-1 text-xs text-muted">{participant.role?.name ?? "Роль не назначена"}</p>
                  </div>

                  {days.map((day) => {
                    const cards = participant.cards.filter((card) => dateKey(card.date) === day);
                    return (
                      <div key={day} className="relative min-h-40 min-w-0 border-l border-border p-2">
                        {canEdit ? (
                          <button
                            type="button"
                            className="absolute inset-0 z-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                            title={`Добавить задачу на ${formatShortDate(day)}`}
                            aria-label={`Добавить задачу на ${formatShortDate(day)}`}
                            onClick={() => openNewCard(participant, day)}
                          />
                        ) : null}
                        {canEdit ? (
                          <button
                            type="button"
                            className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-slate-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title={`Добавить задачу на ${formatShortDate(day)}`}
                            aria-label={`Добавить задачу на ${formatShortDate(day)}`}
                            onClick={() => openNewCard(participant, day)}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        ) : null}

                        <div className={canEdit ? "pointer-events-none relative z-10 grid gap-2 pt-8" : "grid gap-2"}>
                          {cards.map((card) => (
                            <TaskCardItem
                              key={card.id}
                              card={card}
                              onOpen={() => openExistingCard(participant, card)}
                            />
                          ))}
                          {cards.length === 0 ? (
                            <p className="px-1 py-2 text-xs text-muted">Нет записей</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {editor ? (
        <TaskEditor
          editor={editor}
          values={values}
          saving={saving}
          error={editorError}
          onChange={setValues}
          onClose={() => setEditor(null)}
          onSubmit={saveCard}
        />
      ) : null}
    </section>
  );
}

function TaskCardItem({ card, onOpen }: { card: TaskCard; onOpen: () => void }) {
  const link = safeArtifactUrl(card.artifactLink);
  return (
    <div className="pointer-events-auto relative min-w-0 overflow-hidden rounded-md border border-border bg-white shadow-sm">
      <button type="button" className="block min-h-20 min-w-0 w-full overflow-hidden p-2 pr-8 text-left hover:bg-slate-50" onClick={onOpen}>
        <p className="truncate text-xs font-medium">{card.title || "Без названия"}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted">
          {card.doneText || card.description || "Карточка без описания"}
        </p>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted">
          <Clock3 className="h-3 w-3" />
          {formatUpdatedAt(card.updatedAt)}
        </p>
      </button>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="absolute right-2 top-2 text-muted hover:text-primary"
          title="Открыть артефакт"
          aria-label="Открыть артефакт"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null}
    </div>
  );
}

function TaskEditor({
  editor,
  values,
  saving,
  error,
  onChange,
  onClose,
  onSubmit
}: {
  editor: EditorState;
  values: TaskCardValues;
  saving: boolean;
  error: string | null;
  onChange: (values: TaskCardValues) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-editor-title"
        className="max-h-[94svh] w-full max-w-xl overflow-y-auto rounded-t-lg border border-border bg-white p-4 shadow-2xl sm:max-h-[90vh] sm:rounded-lg sm:p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="task-editor-title" className="text-lg font-semibold">
              {editor.card ? "Карточка задачи" : "Новая карточка"}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {editor.participant.displayName} · {formatFullDate(editor.date)}
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-slate-100 hover:text-foreground"
            title="Закрыть"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
          <TaskInput
            label="Название"
            value={values.title}
            readOnly={editor.readOnly}
            onChange={(title) => onChange({ ...values, title })}
          />
          <TaskTextarea
            label="Описание задачи"
            value={values.description}
            readOnly={editor.readOnly}
            rows={3}
            onChange={(description) => onChange({ ...values, description })}
          />
          <TaskTextarea
            label="Что было сделано"
            value={values.doneText}
            readOnly={editor.readOnly}
            rows={4}
            onChange={(doneText) => onChange({ ...values, doneText })}
          />
          <TaskInput
            label="Ссылка на артефакт"
            value={values.artifactLink}
            readOnly={editor.readOnly}
            type="url"
            placeholder="https://github.com/..."
            onChange={(artifactLink) => onChange({ ...values, artifactLink })}
          />

          {editor.card ? (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Clock3 className="h-4 w-4" />
              Последнее обновление: {formatDateTime(editor.card.updatedAt)}
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              {editor.readOnly ? "Закрыть" : "Отмена"}
            </Button>
            {!editor.readOnly ? (
              <Button type="submit" disabled={saving}>
                {saving ? "Сохраняем..." : "Сохранить"}
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskInput({
  label,
  value,
  readOnly,
  type = "text",
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  readOnly: boolean;
  type?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <Input
        type={type}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        className={readOnly ? "bg-slate-50" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TaskTextarea({
  label,
  value,
  readOnly,
  rows,
  onChange
}: {
  label: string;
  value: string;
  readOnly: boolean;
  rows: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <textarea
        className={`w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${readOnly ? "bg-slate-50" : "bg-white"}`}
        rows={rows}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function buildWeekStarts(practiceStart: string, practiceEnd: string) {
  const first = monday(dateKey(practiceStart));
  const last = monday(dateKey(practiceEnd));
  const weeks: string[] = [];
  for (let current = first; current <= last; current = addDays(current, 7)) {
    weeks.push(current);
  }
  return weeks;
}

function defaultWeek(practiceStart: string, practiceEnd: string) {
  const start = dateKey(practiceStart);
  const end = dateKey(practiceEnd);
  const today = localDateKey(new Date());
  if (today < start) {
    return monday(start);
  }
  if (today > end) {
    return monday(end);
  }
  return monday(today);
}

function workingDays(weekStart: string, practiceStart: string, practiceEnd: string) {
  const start = dateKey(practiceStart);
  const end = dateKey(practiceEnd);
  return Array.from({ length: 5 }, (_, index) => addDays(weekStart, index)).filter(
    (day) => day >= start && day <= end
  );
}

function monday(value: string) {
  const date = parseDate(value);
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(value, -offset);
}

function addDays(value: string, amount: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekdayLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" })
    .format(parseDate(value))
    .replace(".", "");
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(parseDate(value));
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(parseDate(value));
}

function formatWeek(days: string[]) {
  if (days.length === 1) {
    return formatFullDate(days[0]);
  }
  return `${formatShortDate(days[0])} - ${formatFullDate(days[days.length - 1])}`;
}

function formatPeriod(start: string, end: string) {
  return `${formatShortDate(dateKey(start))} - ${formatFullDate(dateKey(end))}`;
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function safeArtifactUrl(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
