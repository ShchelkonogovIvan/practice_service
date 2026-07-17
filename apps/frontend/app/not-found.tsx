import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverviewLink } from "@/components/overview-link";

export default function NotFoundPage() {
  return (
    <main className="relative mx-auto grid min-h-screen w-full max-w-3xl place-items-center px-5 py-20">
      <OverviewLink className="absolute left-5 top-5" />
      <div className="w-full border border-border bg-white p-6 sm:p-8">
        <SearchX className="h-7 w-7 text-primary" />
        <p className="mt-4 text-sm font-semibold text-primary">Ошибка 404</p>
        <h1 className="mt-2 text-2xl font-semibold">Страница не найдена</h1>
        <p className="mt-3 leading-7 text-muted">Проверьте адрес страницы или вернитесь на главную.</p>
        <Button asChild className="mt-6">
          <Link href="/">На главную</Link>
        </Button>
      </div>
    </main>
  );
}
