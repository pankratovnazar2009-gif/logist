# Logist Matchmaker — MVP

Веб-маршрутизатор заявок для польского рынка TSL: логисты выкладывают грузы, перевозчики
получают SMS о подходящих грузах (по направлению и типу кузова), пока база логистов пустая —
грузы подтягиваются парсером из открытых FB-групп.

Это переход от прежнего Telegram-бота (n8n) к отдельному веб-приложению. n8n-воркфлоу
("Logist Bot — ...") больше не используются этим проектом и сейчас на паузе — можно
включить обратно из n8n, если понадобятся для сравнения, либо архивировать позже.

## Структура

```
supabase/migrations/0001_init.sql   — схема БД (Postgres/Supabase)
backend/                            — Node.js/Express/TypeScript API
parser/                             — Python-скрипт: FB-группы → LLM → backend
```

Фронтенда (PWA) в этой итерации ещё нет — сначала база + backend, по твоим словам это
приоритет. React/Next.js PWA — следующий шаг.

## Что нужно завести самому (я этого сделать не могу — сторонние аккаунты/оплата)

1. **Supabase-проект** — https://supabase.com → New project → скопировать `Project URL`
   и `service_role` key (Settings → API) в `backend/.env`.
   Прогнать миграцию: в Supabase Dashboard → SQL Editor → вставить содержимое
   `supabase/migrations/0001_init.sql` → Run.
2. **SMS**: SMSAPI.pl (https://ssl.smsapi.pl, токен в панели: OAuth/Tokeny) — приоритетно
   для польского b2b-трафика; либо Twilio, если проще стартовать. Переключается одной
   переменной `SMS_PROVIDER` в `backend/.env`.
3. **GUS/REGON API-ключ** (бесплатно) — https://api.stat.gov.pl/Home/RegonApi. До получения
   своего ключа стоит публичный тестовый (`GUS_ENV=test`), но тестовая среда отдаёт только
   фиктивные тестовые фирмы — для реальных НИПов нужен `GUS_ENV=prod` + свой ключ.
4. **OpenAI API key** — https://platform.openai.com/api-keys, для `parser/.env`.
5. **Python 3.10+** — на этой машине сейчас не установлен (только заглушка Microsoft Store).
   Поставь с https://python.org, если будешь запускать парсер локально; либо парсер можно
   гонять на отдельном сервере/VPS (как и планировалось изначально).

## Backend — запуск

```bash
cd backend
npm install
copy .env.example .env    # затем вписать реальные ключи
npm run dev
```

Проверить: `GET http://localhost:4000/health` → `{ "ok": true }`.

Уже реализовано (`backend/src`):
- `POST /api/auth/otp/request`, `POST /api/auth/otp/verify` — вход по SMS-коду.
- `POST /api/auth/google` — вход логиста через Google (принимает Supabase Auth access token
  с фронта; сам OAuth-флоу — фронтендная часть, ещё не сделана).
- `POST /api/users/me/profile` — выбор роли + профиль; для логиста с `nip` — автоподтяжка
  `company_name` из GUS.
- `GET /api/nip/:nip` — предпросмотр данных фирмы по НИП до сохранения.
- `POST /api/loads`, `GET /api/loads/:id` — грузы, добавленные логистом напрямую в приложении.
- `POST /api/internal/loads`, `GET /api/internal/fb-groups` — внутренние эндпоинты для
  Python-парсера (защищены `x-internal-key`, не пользовательским JWT).
- Матчинг (`services/matching.ts`) — при появлении нового груза ищет перевозчиков с
  пересекающимися `preferred_routes`/`truck_types` и шлёт им SMS со ссылкой на груз;
  дедуплицируется через `notifications_log`, чтобы не слать повторно.

`npx tsc --noEmit` уже прогнан — компилируется чисто.

## Parser — запуск

```bash
cd parser
pip install -r requirements.txt
playwright install chromium
copy .env.example .env    # вписать ключи; INTERNAL_API_KEY должен совпадать с backend/.env
python save_session.py    # один раз: руками логинишься в FB, сессия сохраняется в файл
python main.py            # дальше работает в цикле само, по расписанию POLL_INTERVAL_SECONDS
```

Важный принцип, перенесённый из прошлой итерации на n8n: **скрипт никогда сам не проходит
логин/капчу/checkpoint Facebook**. Сессия логинится один раз руками через `save_session.py`;
если Facebook посреди работы потребует повторную проверку — `fb_scraper.py` останавливается
и печатает предупреждение вместо попытки обойти проверку.

## Дальше по плану (не сделано в этой итерации)

- Frontend PWA (React/Next.js): онбординг (выбор роли, форма профиля, ввод НИП с live-превью
  через `GET /api/nip/:nip`), лента грузов для перевозчика, страница груза `/loads/:id` (то,
  куда ведёт ссылка из SMS), форма добавления груза для логиста.
- Список `fb_groups` в БД сейчас пустой — нужно занести стартовый список групп (можно взять
  из старого [logist-bot-spec.md](logist-bot-spec.md), там уже 19 URL).
- Пока нет автоматического "протухания" статуса `loads.status = 'expired'` — таблица уже
  готова (`expires_at`), не хватает крон-джобы/функции, которая её проставляет.
- Уточнить у GUS API реальный формат ответа на своём ключе (`backend/src/services/gus.ts`
  написан по официальной документации BIR1.1, но SOAP-ответы стоит свериться на реальном
  тестовом вызове — тестовая среда возвращает вымышленные компании, не настоящие НИПы).
