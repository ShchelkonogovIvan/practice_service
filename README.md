# practice_service

Сервис для организации студенческой практики.

Сейчас в проекте есть базовая структура:

- frontend на Next.js + TypeScript;
- backend на Express + TypeScript;
- PostgreSQL через Prisma;
- регистрация и вход по email/паролю;
- JWT-авторизация;
- базовые модели для когорт, заявок, документов и задач.

## Как запустить

Сначала нужны Node.js, pnpm и Docker Desktop.

```powershell
cd C:\Users\Flait\Documents\Codex\2026-07-06\orm
Copy-Item .env.example .env
docker compose up -d db
pnpm.cmd install
pnpm.cmd prisma:generate
pnpm.cmd prisma:migrate
pnpm.cmd seed
pnpm.cmd dev
```

После запуска:

- сайт: http://localhost:3000
- API: http://localhost:4000/api/health

Тестовый админ:

```text
email: admin@example.com
password: admin12345
```

## Структура

```text
apps/
  backend/   REST API, Prisma, авторизация
  frontend/  Next.js интерфейс
```

## Полезные команды

```powershell
pnpm.cmd dev
pnpm.cmd build
pnpm.cmd prisma:migrate
pnpm.cmd seed
```

