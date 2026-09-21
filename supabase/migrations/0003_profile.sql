-- Pozna.logist — профиль пользователя: имя, e-mail, фото, языки.
-- Запускать в Supabase → SQL Editor после 0002_matching.sql. Повторный запуск безопасен.

alter table users
  add column if not exists full_name  text check (full_name is null or char_length(full_name) between 2 and 80),
  add column if not exists email      text check (email is null or char_length(email) <= 254),
  add column if not exists avatar_url text,
  add column if not exists languages  text[] not null default '{}';

-- Публичный бакет для фото профиля. Читать может любой по ссылке, писать — только backend (service_role);
-- политик на запись не создаём намеренно: из браузера в бакет напрямую не загрузить.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
