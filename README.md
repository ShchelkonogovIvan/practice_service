# Практика

Сервис для организации студенческой практики.

Сейчас в проекте есть базовая структура:

- frontend на Next.js + TypeScript.
- backend на Express + TypeScript;
- PostgreSQL через Prisma;
- регистрация и вход по email/паролю;
- JWT-авторизация;
- базовые модели для когорт, заявок, документов и задач;
- добавлен модуль когорт: админ может создавать когорты, указывая сроки приема заявок и практики, добавлять роли/направления, тестовые задания;
- добавлен модуль заявок на практику.

## Как запустить

Сначала нужны Node.js, pnpm и Docker Desktop.

Перейдите в папку проекта:

```powershell
cd practice_service
```

Дальше:

```powershell
Copy-Item .env.example .env
docker compose up -d db mailpit
pnpm.cmd install
pnpm.cmd prisma:generate
pnpm.cmd prisma:migrate
pnpm.cmd seed
pnpm.cmd dev
```

После запуска:

- сайт: http://localhost:3000
- API: http://localhost:4000/api/health
- локальная почта: http://localhost:8025

Аккаунт тестового админа:

```powershell
admin@example.com
admin12345
```
