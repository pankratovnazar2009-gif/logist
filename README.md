# Logist Matchmaker — MVP

Веб-приложение (PWA) для польского рынка TSL: логисты выставляют грузы, перевозчики получают SMS о подходящих
(по направлению и типу кузова). Пока база пуста — грузы подтягивает парсер из открытых FB-групп.

**Одно приложение = один проект Vercel.** Интерфейс и API — один Next.js в корне репозитория:

```
src/app/            — страницы (login, onboarding, loads, loads/[id], loads/new) + PWA-манифест
src/app/api/        — API (route handlers): вход по SMS, профиль, GUS/NIP, грузы, внутренние вызовы парсера
src/lib/server/     — серверная логика: Supabase, SMS (SMSAPI.pl/Twilio), GUS, матчинг
supabase/migrations — схема БД
parser/             — Python-парсер FB-групп (запускается ОТДЕЛЬНО, не на Vercel — см. ниже)
```

## Деплой на Vercel

1. Vercel → **Add New… → Project** → выбери этот репозиторий. Framework определится сам (Next.js),
   Root Directory оставь пустым. Build/Output настройки не трогай.
2. До нажатия Deploy добавь **Environment Variables** (список в [.env.example](.env.example)). Обязательные:
   - `SUPABASE_URL` — Project URL из Supabase (без `/rest/v1/`)
   - `SUPABASE_SERVICE_ROLE_KEY` — Secret key (`sb_secret_...`)
   - `APP_JWT_SECRET` — любая длинная случайная строка (≥ 16 символов)
   - `INTERNAL_API_KEY` — любая случайная строка, тот же секрет пойдёт в парсер
   - `SMSAPI_TOKEN` — токен SMSAPI.pl (или `SMS_PROVIDER=twilio` + `TWILIO_*`)
   - `GUS_ENV` = `test` (пока нет своего ключа GUS) или `prod` + `GUS_API_KEY`
3. Deploy. `APP_BASE_URL` задавать не нужно — ссылки в SMS берутся из домена Vercel (если подключишь
   свой домен, задай `APP_BASE_URL=https://твой-домен`).
4. Миграцию БД один раз прогони в Supabase → SQL Editor: [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql).

## Локальный запуск

```bash
npm install
copy .env.example .env.local    # впиши реальные значения
npm run dev                     # http://localhost:3000
```

## Парсер FB-групп (`parser/`)

Python + Playwright + OpenAI. На Vercel он **не запускается** (долгоживущий процесс с браузером и живой
сессией Facebook) — гоняй его на своём ПК или дешёвом VPS. Он ходит в API задеплоенного приложения:
в `parser/.env` укажи `BACKEND_URL=https://<твой-проект>.vercel.app` и тот же `INTERNAL_API_KEY`.

```bash
cd parser
pip install -r requirements.txt && playwright install chromium
copy .env.example .env
python save_session.py    # один раз: логинишься в FB руками, сессия сохраняется в файл
python main.py
```

Скрипт никогда сам не проходит логин/капчу/checkpoint Facebook — при проверке он останавливается.
Список групп лежит в таблице `fb_groups` (сейчас пустая — нужно занести стартовый список).

## Что уже проверено вживую

Вход по SMS (реальная доставка), GUS-поиск по NIP (тестовый контур), создание грузов, лента, карточка
груза, фильтрация «перевозчик ↔ груз», PWA (манифест + service worker).

## Не сделано

- Вход через Google (маршрут `/api/auth/google` есть, кнопки во фронтенде нет).
- Автоматическое «протухание» грузов (`loads.status = 'expired'`; поле `expires_at` уже есть).
- Заполнение `fb_groups` и запуск парсера в продакшене.
