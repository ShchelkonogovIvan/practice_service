import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  ListChecks,
  UsersRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverviewAuthActions } from "@/components/overview-auth-actions";
import { OverviewLink } from "@/components/overview-link";
import { PublicCohorts } from "@/components/public-cohorts";

const features = [
  {
    title: "Заявки",
    description: "Выберите открытый набор, заполните анкету и следите за решением руководителя в личном кабинете.",
    icon: ClipboardList
  },
  {
    title: "Документы",
    description: "Заполняйте данные один раз, загружайте отчёт и скачивайте подготовленные документы по практике.",
    icon: FileText
  },
  {
    title: "Задачи",
    description: "Фиксируйте выполненную работу по дням и сохраняйте ссылки на результаты без отдельных таблиц.",
    icon: ListChecks
  },
  {
    title: "Координация",
    description: "Руководители управляют наборами, рассматривают заявки и проверяют документы в одном сервисе.",
    icon: UsersRound
  }
];

const steps = [
  ["01", "Выберите практику", "Посмотрите сроки открытых наборов и требования к кандидатам."],
  ["02", "Отправьте заявку", "Заполните анкету и дождитесь решения руководителя."],
  ["03", "Проходите практику", "Выполняйте задания и работайте с документами."]
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <OverviewLink />
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex" aria-label="Основная навигация">
            <a className="transition hover:text-foreground" href="#features">Возможности</a>
            <a className="transition hover:text-foreground" href="#process">Как это работает</a>
            <a className="transition hover:text-foreground" href="#cohorts">Открытые наборы</a>
          </nav>
          <OverviewAuthActions />
        </div>
      </header>

      <main>
        <section id="overview" className="scroll-mt-6 border-b border-border bg-slate-50">
          <div className="mx-auto flex h-[calc(100svh-5rem)] min-h-[440px] max-h-[680px] w-full max-w-6xl items-center px-4 py-14 sm:px-6">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-primary">Сервис сопровождения учебной практики</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">Практика</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
                Единое пространство для студентов и руководителей: от подачи заявки до подготовки документов,
                ежедневных задач и итогового отчёта.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild>
                  <a href="#cohorts">
                    Посмотреть наборы
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/dashboard">Открыть кабинет</Link>
                </Button>
              </div>
              <p className="mt-8 max-w-xl border-l-2 border-amber-400 pl-4 text-sm leading-6 text-muted">
                Все этапы практики собраны в одном месте, поэтому статусы, документы и результаты работы не
                теряются в переписке.
              </p>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-6 border-b border-border py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-primary">Возможности</p>
              <h2 className="mt-3 text-3xl font-semibold">Всё необходимое для прохождения практики</h2>
              <p className="mt-4 leading-7 text-muted">
                Сервис связывает основные процессы и показывает каждому участнику только нужные ему действия.
              </p>
            </div>
            <div className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="border-t-2 border-foreground pt-5">
                    <Icon className="h-5 w-5 text-primary" />
                    <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="process" className="scroll-mt-6 border-b border-border bg-slate-50 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <p className="text-sm font-semibold text-primary">Как это работает</p>
            <h2 className="mt-3 text-3xl font-semibold">Три шага от заявки до практики</h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {steps.map(([number, title, description]) => (
                <div key={number} className="border-l border-border pl-5">
                  <p className="text-sm font-semibold text-amber-700">{number}</p>
                  <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="cohorts" className="scroll-mt-6 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <PublicCohorts />
          </div>
        </section>

        <section className="bg-foreground py-14 text-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Уже участвуете в практике?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">Откройте кабинет, чтобы проверить заявки, документы и задачи.</p>
            </div>
            <Button asChild variant="secondary">
              <Link href="/dashboard">Перейти в кабинет</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© 2026 Практика</p>
          <p>Сервис для организации и сопровождения учебной практики</p>
        </div>
      </footer>
    </div>
  );
}
