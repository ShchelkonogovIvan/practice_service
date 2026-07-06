"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register, setToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Mode = "login" | "register";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = mode === "login" ? await login(email, password) : await register(email, password);
      setToken(result.token);
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не получилось войти");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full p-6">
      <div className="mb-6">
        <p className="text-sm text-muted">Практика</p>
        <h1 className="mt-1 text-2xl font-semibold">
          {mode === "login" ? "Вход" : "Регистрация"}
        </h1>
      </div>

      <form className="grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-2 text-sm font-medium">
          Email
          <Input
            autoComplete="email"
            inputMode="email"
            placeholder="student@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          Пароль
          <Input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Button type="submit" disabled={loading}>
          {loading ? "Секунду..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
        </Button>
      </form>

      <button
        className="mt-5 text-sm font-medium text-primary hover:underline"
        type="button"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
      </button>
    </Card>
  );
}

