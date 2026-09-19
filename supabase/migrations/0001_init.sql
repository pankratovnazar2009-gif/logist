-- Logist Matchmaker MVP — initial schema
-- Все таблицы закрыты RLS "по умолчанию deny": единственный клиент, который их читает/пишет —
-- backend (Node/Express) через service_role key. Фронтенд никогда не обращается к Supabase напрямую
-- (кроме Google OAuth и, в будущем, realtime-подписок через отдельные view/policy).

create extension if not exists "pgcrypto";

create type user_role as enum ('logist', 'carrier');
create type load_source as enum ('facebook', 'direct');
create type load_status as enum ('active', 'matched', 'expired');

-- ─────────────────────────────────────────────────────────────────────────
-- users — и логисты, и перевозчики в одной таблице, различаются по role
-- ─────────────────────────────────────────────────────────────────────────
create table users (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid unique references auth.users(id) on delete set null, -- заполняется при входе через Google
  phone          varchar(20) unique,                                       -- заполняется при входе по SMS-коду
  role           user_role,                                                 -- null пока не выбрана роль на онбординге
  company_name   text,                                                      -- подтягивается по NIP из GUS
  nip            varchar(10),
  truck_types    text[] not null default '{}',                             -- firanka / chlodnia / bus / plandeka / ...
  preferred_routes text[] not null default '{}',                           -- коды направлений: 'PL-MZ', 'DE', 'FR', ...
  created_at     timestamptz not null default now(),
  constraint users_identity_check check (auth_user_id is not null or phone is not null)
);

create index users_role_idx on users (role);
create index users_preferred_routes_gin on users using gin (preferred_routes);
create index users_truck_types_gin on users using gin (truck_types);

-- ─────────────────────────────────────────────────────────────────────────
-- otp_codes — коды подтверждения телефона (свой SMS-провайдер, не Supabase Auth)
-- ─────────────────────────────────────────────────────────────────────────
create table otp_codes (
  id          uuid primary key default gen_random_uuid(),
  phone       varchar(20) not null,
  code        varchar(6) not null,
  attempts    int not null default 0,
  verified_at timestamptz,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index otp_codes_phone_idx on otp_codes (phone, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- fb_groups — список групп для парсера (аналог старой вкладки Groups)
-- ─────────────────────────────────────────────────────────────────────────
create table fb_groups (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  url             text not null unique,
  active          boolean not null default true,
  last_checked_at timestamptz
);

-- ─────────────────────────────────────────────────────────────────────────
-- loads — грузы/объявления (из Facebook или добавленные напрямую в приложении)
-- ─────────────────────────────────────────────────────────────────────────
create table loads (
  id                 uuid primary key default gen_random_uuid(),
  source             load_source not null default 'facebook',
  logist_id          uuid references users(id) on delete set null, -- заполнено, если груз добавлен зарегистрированным логистом
  origin             text,
  destination        text,
  origin_region      varchar(8),   -- нормализованный код направления для матчинга: 'PL-MZ', 'DE', 'FR' ...
  destination_region varchar(8),
  truck_required     text,
  price              text,
  raw_text           text,         -- исходный текст поста — для верификации/аудита
  raw_text_hash       varchar(64), -- sha256 исходного текста — дедупликация повторных постов
  contact_info       text,
  status             load_status not null default 'active',
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null default (now() + interval '48 hours')
);

create index loads_status_idx on loads (status);
create index loads_regions_idx on loads (origin_region, destination_region);
create unique index loads_raw_text_hash_uidx on loads (raw_text_hash) where raw_text_hash is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- notifications_log — кому и когда ушла SMS по конкретному грузу (анти-дублирование)
-- ─────────────────────────────────────────────────────────────────────────
create table notifications_log (
  id        uuid primary key default gen_random_uuid(),
  load_id   uuid not null references loads(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  status    varchar(16) not null default 'sent', -- sent / failed
  sent_at   timestamptz not null default now(),
  unique (load_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- RLS: включаем на всех таблицах, политик не создаём — доступ только через service_role (backend)
-- ─────────────────────────────────────────────────────────────────────────
alter table users enable row level security;
alter table otp_codes enable row level security;
alter table fb_groups enable row level security;
alter table loads enable row level security;
alter table notifications_log enable row level security;
