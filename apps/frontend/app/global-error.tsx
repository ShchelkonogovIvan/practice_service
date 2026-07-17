"use client";

import { AlertTriangle, BookOpenCheck, RotateCcw } from "lucide-react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body>
        <main className="relative mx-auto grid min-h-screen w-full max-w-3xl place-items-center px-5 py-20">
          <a
            aria-label="Перейти на обзорную страницу"
            className="absolute left-5 top-5 inline-flex items-center gap-2 text-base font-semibold"
            href="/"
            title="Обзорная страница"
          >
            <span className="grid h-9 w-9 place-items-center rounded-md bg-blue-700 text-white">
              <BookOpenCheck className="h-5 w-5" />
            </span>
            Практика
          </a>
          <div className="w-full border border-red-200 bg-white p-6 sm:p-8">
            <AlertTriangle className="h-7 w-7 text-red-700" />
            <h1 className="mt-4 text-2xl font-semibold">Сервис временно недоступен</h1>
            <p className="mt-3 leading-7 text-slate-600">
              Не удалось загрузить приложение. Повторите попытку через несколько секунд.
            </p>
            <button
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-medium text-white"
              type="button"
              onClick={reset}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Повторить
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
