"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverviewLink } from "@/components/overview-link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative mx-auto grid min-h-screen w-full max-w-3xl place-items-center px-5 py-20">
      <OverviewLink className="absolute left-5 top-5" />
      <div className="w-full border border-red-200 bg-white p-6 sm:p-8">
        <AlertTriangle className="h-7 w-7 text-red-700" />
        <h1 className="mt-4 text-2xl font-semibold">Не удалось открыть страницу</h1>
        <p className="mt-3 leading-7 text-muted">
          Произошла непредвиденная ошибка. Попробуйте загрузить раздел ещё раз или вернитесь на главную страницу.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Повторить
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">На главную</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
