import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicCohorts } from "@/components/public-cohorts";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <Card className="p-6">
        <p className="text-sm text-muted">Сервис для организации и сопровождения практики</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Практика</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
          Здесь кандидат может посмотреть открытые наборы, анкету и тестовое задание.
          Чтобы подать заявку, нужно зарегистрироваться или войти в аккаунт.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/auth">Войти или зарегистрироваться</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/dashboard">Личный кабинет</Link>
          </Button>
        </div>
      </Card>

      <PublicCohorts />
    </main>
  );
}
