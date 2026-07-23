# Практика

Сервис для организации студенческой практики.

Сейчас в проекте есть базовая структура:

- frontend на Next.js + TypeScript.
- backend на Express + TypeScript;
- PostgreSQL через Prisma;
- регистрация и вход по email/паролю;
- JWT-авторизация;
- управление когортами, сроками, анкетами, ролями и тестовыми заданиями;
- подача и рассмотрение заявок на практику;
- сдача и проверка тестового задания с текстом, ссылкой или PDF/DOCX;
- документы практиканта, проверка отчёта и формирование DOCX по шаблонам;
- доска задач и прогресс участников;
- экспорт сводки когорты в CSV для администратора;
- email-уведомления и встроенный центр событий со статусом прочтения;
- адаптивные кабинеты студента и администратора.

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

Полная локальная проверка после запуска PostgreSQL:

```powershell
pnpm.cmd verify:full
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
