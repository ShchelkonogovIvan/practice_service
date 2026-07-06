"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { AuthUser, activeCohort, clearToken, currentUser, myApplications } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type AppRow = {
  id: string;
  status: string;
  cohort: { name: string };
};

type Cohort = {
  id: string;
  name: string;
  surveyFields: Array<{ id: string; label: string; type: string }>;
};

export function DashboardShell() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [applications, setApplications] = useState<AppRow[]>([]);
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([currentUser(), myApplications(), activeCohort()])
      .then(([userResult, applicationResult, cohortResult]) => {
        setUser(userResult.user);
        setApplications(applicationResult.applications);
        setCohort(cohortResult.cohort);
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Нужно войти заново");
      });
  }, []);

  function logout() {
    clearToken();
    router.push("/auth");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Личный кабинет</p>
          <h1 className="text-2xl font-semibold tracking-tight">Практика</h1>
        </div>
        <Button variant="secondary" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Выйти
        </Button>
      </header>

      {error ? (
        <Card className="p-5">
          <p className="font-medium text-red-700">{error}</p>
          <Button className="mt-4" onClick={() => router.push("/auth")}>
            Войти
          </Button>
        </Card>
      ) : null}

      <div className="grid gap-4">
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Профиль</h2>
          <p className="mt-2 text-sm text-muted">
            {user ? `${user.email} · ${user.role}` : "Загрузка..."}
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold">Активная когорта</h2>
          <p className="mt-2 text-sm text-muted">
            {cohort ? cohort.name : "Сейчас нет открытого набора."}
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold">Заявки</h2>
          <div className="mt-4 grid gap-3">
            {applications.length === 0 ? (
              <p className="text-sm text-muted">Заявок пока нет.</p>
            ) : (
              applications.map((application) => (
                <div key={application.id} className="rounded-md border border-border bg-white px-4 py-3">
                  <p className="font-medium">{application.cohort.name}</p>
                  <p className="text-sm text-muted">Статус: {application.status}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}

