# Практика

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

Если проект уже склонирован, перейдите в папку проекта:

```powershell
cd practice_service
```

Дальше:

```powershell
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


