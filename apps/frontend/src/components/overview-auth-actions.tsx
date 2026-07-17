"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { getToken } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function OverviewAuthActions() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthenticated(Boolean(getToken()));
  }, []);

  if (authenticated === null) {
    return <div className="h-10 w-24" aria-hidden="true" />;
  }

  if (authenticated) {
    return (
      <Button asChild>
        <Link href="/dashboard">
          <UserRound className="mr-2 h-4 w-4" />
          Профиль
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="secondary">
        <Link href="/auth">Войти</Link>
      </Button>
      <Button asChild className="hidden sm:inline-flex">
        <Link href="/auth">Регистрация</Link>
      </Button>
    </div>
  );
}
