"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { clearApplicationDraft, clearPendingApplication, getPendingApplication, login, register, setToken, submitApplication } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Mode = "login" | "register";

const MIN_PASSWORD_LENGTH = 8;

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const trimmedEmail = email.trim();
  const emailFilled = trimmedEmail.length > 0;
  const passwordFilled = password.length > 0;
  const passwordTooShort = mode === "register" && passwordFilled && password.length < MIN_PASSWORD_LENGTH;
  const passwordsMismatch = mode === "register" && passwordConfirm.length > 0 && password !== passwordConfirm;
  const canSubmit =
    mode === "login"
      ? emailFilled && passwordFilled
      : emailFilled &&
        password.length >= MIN_PASSWORD_LENGTH &&
        passwordConfirm.length > 0 &&
        password === passwordConfirm;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!canSubmit) {
      setError(mode === "login" ? "Заполните email и пароль" : "Проверьте email и пароли");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = mode === "login" ? await login(trimmedEmail, password) : await register(trimmedEmail, password);
      setToken(result.token);

      const pendingApplication = getPendingApplication();
      if (pendingApplication) {
        await submitApplication(pendingApplication.cohortId, pendingApplication.answers);
        clearApplicationDraft(pendingApplication.cohortId);
        clearPendingApplication();
      }

      router.push("/dashboard");
    } catch (caught) {
      setError(mapAuthError(caught));
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(mode === "login" ? "register" : "login");
    setError(null);
    setPassword("");
    setPasswordConfirm("");
    setShowPassword(false);
    setShowPasswordConfirm(false);
  }

  return (
    <Card className="w-full p-6">
      <div className="mb-6">
        <p className="text-sm text-muted">Практика</p>
        <h1 className="mt-1 text-2xl font-semibold">
          {mode === "login" ? "Вход в систему" : "Регистрация пользователя"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {mode === "login"
            ? "Введите email и пароль, чтобы попасть в личный кабинет."
            : "Создайте аккаунт кандидата. После регистрации вы будете авторизованы автоматически."}
        </p>
      </div>

      <form className="grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-2 text-sm font-medium">
          Email
          <Input
            autoComplete="email"
            inputMode="email"
            placeholder="student@example.com"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <PasswordField
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          label="Пароль"
          minLength={mode === "register" ? MIN_PASSWORD_LENGTH : undefined}
          show={showPassword}
          value={password}
          onChange={setPassword}
          onToggle={() => setShowPassword((current) => !current)}
        />

        {mode === "register" ? (
          <PasswordField
            autoComplete="new-password"
            label="Подтверждение пароля"
            minLength={MIN_PASSWORD_LENGTH}
            show={showPasswordConfirm}
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            onToggle={() => setShowPasswordConfirm((current) => !current)}
          />
        ) : null}

        {passwordTooShort ? (
          <p className="text-sm text-red-700">Пароль слишком короткий: минимум 8 символов.</p>
        ) : null}

        {passwordsMismatch ? <p className="text-sm text-red-700">Пароли не совпадают.</p> : null}

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Button type="submit" disabled={loading || !canSubmit}>
          {loading ? "Подождите..." : mode === "login" ? "Войти" : "Создать аккаунт"}
        </Button>
      </form>

      <button className="mt-5 text-sm font-medium text-primary hover:underline" type="button" onClick={switchMode}>
        {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
      </button>
    </Card>
  );
}

function PasswordField({
  label,
  value,
  show,
  autoComplete,
  minLength,
  onChange,
  onToggle
}: {
  label: string;
  value: string;
  show: boolean;
  autoComplete: string;
  minLength?: number;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <span className="relative block">
        <Input
          autoComplete={autoComplete}
          className="pr-11"
          minLength={minLength}
          required
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          aria-label={show ? "Скрыть пароль" : "Показать пароль"}
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-slate-100 hover:text-foreground"
          type="button"
          onClick={onToggle}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}

function mapAuthError(caught: unknown) {
  if (!(caught instanceof Error)) {
    return "Ошибка входа, попробуйте позже";
  }

  if (caught.message === "Internal server error") {
    return "Ошибка входа, попробуйте позже";
  }

  return caught.message;
}
