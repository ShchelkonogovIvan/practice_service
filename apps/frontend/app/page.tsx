import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-8">
      <Card className="w-full p-6">
        <p className="text-sm text-muted">Сервис практики</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Практика</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
          Здесь будут заявки, документы и задачи студентов. Пока доступен базовый вход
          и личный кабинет.
        </p>

        <div className="mt-6 flex gap-3">
          <Button asChild>
            <Link href="/auth">Войти</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/dashboard">Кабинет</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}

