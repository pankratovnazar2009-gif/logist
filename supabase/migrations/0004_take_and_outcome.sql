-- Pozna.logist — «беру» для грузов из Facebook (первый ответивший забирает, остальным — «занято»)
-- и опрос через сутки «состоялась ли перевозка». Запускать после 0003_profile.sql. Повторный запуск безопасен.

-- ─────────────────────────────────────────────────────────────────────────
-- match_requests: результат сделки (для базы проверенных перевозчиков) и защита от повторного
-- уведомления владельца при повторном клике/сетевом повторе.
-- ─────────────────────────────────────────────────────────────────────────
alter table match_requests
  add column if not exists outcome             text not null default 'unknown' check (outcome in ('unknown', 'completed', 'failed')),
  add column if not exists outcome_asked_at     timestamptz,
  add column if not exists outcome_recorded_at  timestamptz,
  add column if not exists owner_notified_at    timestamptz;

alter table match_notifications drop constraint if exists match_notifications_kind_check;
alter table match_notifications add constraint match_notifications_kind_check
  check (kind in ('match', 'requested', 'confirmed', 'load_taken', 'offer_taken', 'outcome_request'));

-- ─────────────────────────────────────────────────────────────────────────
-- match_apply: добавляем действие 'take' — прямой переход pending → confirmed без «request/confirm»,
-- для пары, где одна сторона пришла из Facebook (там некому подтверждать). Первый нажавший забирает,
-- конкурирующие пары по тому же грузу/предложению закрываются — та же блокировка строк, что и раньше.
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
  if p_action not in ('request', 'confirm', 'decline', 'take') then
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
     or (p_action = 'take' and m.status = 'confirmed')
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

  if p_action = 'take' then
    if l.logist_id is not null and o.carrier_id is not null then
      -- Обе стороны в приложении — берём обычным путём: request → confirm.
      return jsonb_build_object('ok', false, 'error', 'not_applicable');
    end if;
    if m.status <> 'pending' then
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
  end if;

  -- request / confirm требуют, чтобы обе стороны были в приложении (для одной FB-стороны — действие 'take' выше).
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

-- ─────────────────────────────────────────────────────────────────────────
-- match_record_outcome — «состоялась ли перевозка», спрашиваем у перевозчика через сутки после confirmed.
-- Строит базу проверенных: кто, куда, каким кузовом реально возит.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function match_record_outcome(p_match uuid, p_user uuid, p_outcome text)
returns jsonb
language plpgsql
as $$
declare
  m match_requests%rowtype;
  l loads%rowtype;
  o carrier_offers%rowtype;
begin
  if p_outcome not in ('completed', 'failed') then
    return jsonb_build_object('ok', false, 'error', 'invalid_outcome');
  end if;

  select * into m from match_requests where id = p_match for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if m.status <> 'confirmed' then
    return jsonb_build_object('ok', false, 'error', 'invalid_state', 'status', m.status);
  end if;

  select * into l from loads          where id = m.load_id;
  select * into o from carrier_offers where id = m.offer_id;
  if not (l.logist_id = p_user or o.carrier_id = p_user) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  update match_requests set outcome = p_outcome, outcome_recorded_at = now() where id = m.id;
  return jsonb_build_object('ok', true, 'outcome', p_outcome);
end;
$$;

revoke execute on function match_apply(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function match_record_outcome(uuid, uuid, text) from public, anon, authenticated;
