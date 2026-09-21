-- Logist Matchmaker — подбор «груз ↔ предложение перевозчика».
-- Запускать в Supabase → SQL Editor ОДИН раз, после 0001_init.sql. Повторный запуск безопасен.

-- ─────────────────────────────────────────────────────────────────────────
-- loads: дата погрузки, груз, вес — то, по чему ищем перевозчика
-- ─────────────────────────────────────────────────────────────────────────
alter type load_status add value if not exists 'taken';       -- сделка подтверждена
alter type load_status add value if not exists 'cancelled';   -- логист снял груз

alter table loads
  add column if not exists pickup_date date,
  add column if not exists cargo       text,
  add column if not exists weight_kg   integer check (weight_kg is null or weight_kg > 0),
  add column if not exists pallets     integer check (pallets is null or pallets > 0),
  add column if not exists source_url  text;   -- ссылка на исходный FB-пост

create index if not exists loads_pickup_date_idx on loads (pickup_date);

-- ─────────────────────────────────────────────────────────────────────────
-- carrier_offers — «свободен с … по …, еду отсюда (туда)»: из приложения или из FB-групп
-- ─────────────────────────────────────────────────────────────────────────
do $$ begin
  create type offer_status as enum ('active', 'taken', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists carrier_offers (
  id                 uuid primary key default gen_random_uuid(),
  source             load_source not null default 'direct',
  carrier_id         uuid references users(id) on delete cascade,  -- null для объявлений из Facebook
  origin             text,
  destination        text,
  origin_region      varchar(8) not null,                          -- обязателен: без него подбор невозможен
  destination_region varchar(8),                                   -- null = «куда угодно»
  available_from     date not null,
  available_to       date not null,
  truck_type         text,
  capacity_kg        integer check (capacity_kg is null or capacity_kg > 0),
  contact_info       text,
  raw_text           text,
  raw_text_hash      varchar(64),
  source_url         text,
  status             offer_status not null default 'active',
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null,
  constraint offer_window_check check (available_to >= available_from),
  constraint offer_owner_check  check ((source = 'direct') = (carrier_id is not null))
);

create index if not exists carrier_offers_search_idx on carrier_offers (status, origin_region, available_from, available_to);
create index if not exists carrier_offers_carrier_idx on carrier_offers (carrier_id);
create unique index if not exists carrier_offers_raw_text_hash_uidx on carrier_offers (raw_text_hash) where raw_text_hash is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- match_requests — пара (груз, предложение). Состояние — только из конечного списка:
--   pending   → никто ещё не обратился
--   requested → одна сторона хочет связаться (requested_by)
--   confirmed → вторая сторона подтвердила, контакты раскрыты
--   declined  → кто-то отказался (declined_by)
--   closed    → груз/предложение занято, снято или истекло (closed_reason)
-- ─────────────────────────────────────────────────────────────────────────
do $$ begin
  create type match_status as enum ('pending', 'requested', 'confirmed', 'declined', 'closed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type user_party as enum ('logist', 'carrier');
exception when duplicate_object then null; end $$;

create table if not exists match_requests (
  id            uuid primary key default gen_random_uuid(),
  load_id       uuid not null references loads(id) on delete cascade,
  offer_id      uuid not null references carrier_offers(id) on delete cascade,
  status        match_status not null default 'pending',
  requested_by  user_party,
  declined_by   user_party,
  closed_reason text check (closed_reason in ('load_taken', 'offer_taken', 'expired', 'cancelled')),
  score         integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (load_id, offer_id),
  constraint match_state_shape check (
    (status <> 'requested' or requested_by is not null)
    and (status <> 'confirmed' or requested_by is not null)
    and (status <> 'declined' or declined_by is not null)
    and (status <> 'closed'   or closed_reason is not null)
  )
);

create index if not exists match_requests_load_idx on match_requests (load_id);
create index if not exists match_requests_offer_idx on match_requests (offer_id);

-- SMS-уведомления по совпадениям: один вид уведомления на человека на пару — не чаще одного раза.
create table if not exists match_notifications (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references match_requests(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  kind      text not null check (kind in ('match', 'requested', 'confirmed')),
  status    varchar(16) not null default 'sent',   -- sent / failed
  sent_at   timestamptz not null default now(),
  unique (match_id, user_id, kind)
);

alter table carrier_offers      enable row level security;
alter table match_requests      enable row level security;
alter table match_notifications enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- match_apply — единственный способ менять состояние пары. Всё в одной транзакции с блокировкой
-- строк (match → load → offer), поэтому два перевозчика не могут «взять» один груз и двойной
-- клик безопасен: повторное действие с тем же результатом возвращает ok.
-- Возвращает jsonb: { ok: true, status } или { ok: false, error }.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function match_apply(p_match uuid, p_user uuid, p_action text)
returns jsonb
language plpgsql
as $$
declare
  m match_requests%rowtype;
  l loads%rowtype;
  o carrier_offers%rowtype;
  party user_party;
  reason text;
begin
  if p_action not in ('request', 'confirm', 'decline') then
    return jsonb_build_object('ok', false, 'error', 'invalid_action');
  end if;

  select * into m from match_requests where id = p_match for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into l from loads          where id = m.load_id  for update;
  select * into o from carrier_offers where id = m.offer_id for update;

  if l.logist_id is not null and l.logist_id = p_user then party := 'logist';
  elsif o.carrier_id is not null and o.carrier_id = p_user then party := 'carrier';
  else return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  -- Повтор уже выполненного действия — не ошибка.
  if (p_action = 'confirm' and m.status = 'confirmed')
     or (p_action = 'decline' and m.status = 'declined')
     or (p_action = 'request' and m.status = 'requested' and m.requested_by = party) then
    return jsonb_build_object('ok', true, 'status', m.status);
  end if;

  if m.status in ('confirmed', 'declined', 'closed') then
    return jsonb_build_object('ok', false, 'error', 'invalid_state', 'status', m.status);
  end if;

  -- Если груз или предложение уже недоступны — закрываем пару и говорим об этом.
  if l.status not in ('active', 'matched') or o.status <> 'active'
     or l.expires_at < now() or o.expires_at < now() then
    reason := case
      when l.status = 'taken'     then 'load_taken'
      when o.status = 'taken'     then 'offer_taken'
      when l.status = 'cancelled' or o.status = 'cancelled' then 'cancelled'
      else 'expired'
    end;
    update match_requests set status = 'closed', closed_reason = reason, updated_at = now() where id = m.id;
    return jsonb_build_object('ok', false, 'error', 'closed', 'reason', reason);
  end if;

  if p_action = 'decline' then
    update match_requests set status = 'declined', declined_by = party, updated_at = now() where id = m.id;
    return jsonb_build_object('ok', true, 'status', 'declined');
  end if;

  -- request / confirm требуют, чтобы обе стороны были в приложении (контакт FB-автора и так публичен).
  if l.logist_id is null or o.carrier_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_applicable');
  end if;

  if p_action = 'request' then
    if m.status <> 'pending' then
      return jsonb_build_object('ok', false, 'error', 'invalid_state', 'status', m.status);
    end if;
    update match_requests set status = 'requested', requested_by = party, updated_at = now() where id = m.id;
    return jsonb_build_object('ok', true, 'status', 'requested');
  end if;

  -- confirm: подтверждать может только противоположная сторона
  if m.status <> 'requested' or m.requested_by = party then
    return jsonb_build_object('ok', false, 'error', 'invalid_state', 'status', m.status);
  end if;

  update match_requests set status = 'confirmed', updated_at = now() where id = m.id;
  update loads          set status = 'taken' where id = m.load_id;
  update carrier_offers set status = 'taken' where id = m.offer_id;
  update match_requests set status = 'closed', closed_reason = 'load_taken', updated_at = now()
    where load_id = m.load_id and id <> m.id and status in ('pending', 'requested');
  update match_requests set status = 'closed', closed_reason = 'offer_taken', updated_at = now()
    where offer_id = m.offer_id and id <> m.id and status in ('pending', 'requested');
  return jsonb_build_object('ok', true, 'status', 'confirmed');
end;
$$;

-- Функция вызывается только backend'ом (service_role); через публичный REST ей делать нечего.
revoke execute on function match_apply(uuid, uuid, text) from public, anon, authenticated;
