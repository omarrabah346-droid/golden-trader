-- =====================================================================
-- GOLDEN AI TRADER · تجهيز قاعدة البيانات في Supabase
-- الصق هذا الملف كاملاً في: SQL Editor → New query → Run
-- آمن إذا شغّلته أكثر من مرة.
-- =====================================================================

-- 1) جدول ملفات الأعضاء
create table if not exists public.profiles (
  id             uuid primary key references auth.users on delete cascade,
  email          text,
  full_name      text not null default '',
  telegram       text not null default '',
  phone          text not null default '',
  country        text not null default '',
  broker_account text not null default '',
  avatar_url     text not null default '',
  status         text not null default 'new' check (status in ('new','pending','approved','rejected')),
  role           text not null default 'member' check (role in ('member','admin')),
  note           text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.profiles add column if not exists telegram text not null default '';
alter table public.profiles enable row level security;

-- 2) دوال الصلاحيات
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and (status = 'approved' or role = 'admin'));
$$;

-- 3) إنشاء ملف تلقائي لكل مستخدم جديد (إيميل أو Google)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) حماية: العضو ما يقدر يفعّل نفسه أو يصير مدير
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if auth.uid() is null or public.is_admin() then
    return new;                         -- المدير أو محرر SQL
  end if;
  new.role       := old.role;
  new.note       := old.note;
  new.email      := old.email;
  new.created_at := old.created_at;
  if new.status is distinct from old.status
     and not (new.status = 'pending' and old.status in ('new','rejected')) then
    new.status := old.status;           -- العضو يقدر بس يرسل طلب (pending)
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile();

drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles update" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- 5) إعدادات المنصة (مفتاح Twelve Data للأعضاء المفعّلين فقط، وتيليجرام للمدير فقط)
create table if not exists public.config (
  key     text primary key,
  value   text not null default '',
  members boolean not null default false
);
alter table public.config enable row level security;

drop policy if exists "config read"  on public.config;
drop policy if exists "config admin" on public.config;
create policy "config read"  on public.config for select using (public.is_admin() or (members and public.is_member()));
create policy "config admin" on public.config for all using (public.is_admin()) with check (public.is_admin());

insert into public.config (key, value, members) values
  ('twelve_key', '', true),
  ('tg_token',   '', false),
  ('tg_chat',    '', false)
on conflict (key) do nothing;

-- 6) الصور الشخصية
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars read"   on storage.objects;
drop policy if exists "avatars insert" on storage.objects;
drop policy if exists "avatars update" on storage.objects;
create policy "avatars read"   on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 7) تنبيه تيليجرام للمدير عند كل طلب انضمام (يُرسل من الخادم، والتوكن ما يطلع للأعضاء)
create extension if not exists pg_net with schema extensions;

create or replace function public.h(t text) returns text
language sql immutable as $$
  select replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
$$;

create or replace function public.notify_join() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  tok  text;
  chat text;
  msg  text;
  nl   text := chr(10);
begin
  if new.status = 'pending' and old.status is distinct from 'pending' then
    select value into tok  from public.config where key = 'tg_token';
    select value into chat from public.config where key = 'tg_chat';
    if coalesce(tok, '') <> '' and coalesce(chat, '') <> '' then
      msg := '◆ <b>GOLDEN AI TRADER</b>' || nl ||
             '🆕 <b>طلب انضمام جديد</b>' || nl || nl ||
             '👤 الاسم: '      || public.h(new.full_name) || nl ||
             '✈️ تيليجرام: '   || public.h(new.telegram)  || nl ||
             '📧 الإيميل: '    || public.h(new.email)     || nl ||
             '🏦 حساب INFINOX: <code>' || public.h(new.broker_account) || '</code>' || nl ||
             '📱 الهاتف: '     || public.h(coalesce(nullif(new.phone, ''), '—'))   || nl ||
             '🌍 الدولة: '     || public.h(coalesce(nullif(new.country, ''), '—')) || nl || nl ||
             'راجع الطلب من لوحة الإدارة.';
      perform net.http_post(
        url     := 'https://api.telegram.org/bot' || tok || '/sendMessage',
        body    := jsonb_build_object('chat_id', chat, 'text', msg, 'parse_mode', 'HTML'),
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_join_alert on public.profiles;
create trigger profiles_join_alert
  after update on public.profiles
  for each row execute function public.notify_join();

-- =====================================================================
-- 8) بعد ما تسوي حسابك بالموقع: اجعل نفسك المدير
--    غيّر الإيميل للإيميل اللي سجلت فيه، وشغّل هذا السطر لوحده:
--
-- update public.profiles set role = 'admin', status = 'approved' where email = 'ضع_إيميلك_هنا';
-- =====================================================================
