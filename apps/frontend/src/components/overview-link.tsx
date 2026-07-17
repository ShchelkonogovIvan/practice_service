import Link from "next/link";
import { BookOpenCheck } from "lucide-react";

export function OverviewLink({ className = "" }: { className?: string }) {
  return (
    <Link
      aria-label="Перейти на обзорную страницу"
      className={`inline-flex items-center gap-2 text-base font-semibold ${className}`}
      href="/"
      title="Обзорная страница"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-white">
        <BookOpenCheck className="h-5 w-5" />
      </span>
      <span>Практика</span>
    </Link>
  );
}
