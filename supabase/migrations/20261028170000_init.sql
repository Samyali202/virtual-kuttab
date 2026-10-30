-- Virtual Kuttab v1 schema (word-level Hifz; no tajweed)
-- Replayable on hosted Supabase now; self-host later.

create extension if not exists "pgcrypto";

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'learner' check (role in ('learner', 'parent', 'admin')),
  locale text not null default 'ar',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Pinned Quran text (Tanzil Uthmani SSoT for grading)
create table if not exists public.ayahs (
  surah int not null check (surah between 1 and 114),
  ayah int not null check (ayah >= 1),
  text_uthmani text not null,
  content_version text not null default 'tanzil-uthmani-v1',
  primary key (surah, ayah)
);

alter table public.ayahs enable row level security;

create policy "ayahs_read_all"
  on public.ayahs for select
  to authenticated, anon
  using (true);

-- Muallim audio + optional word timings (URLs point at R2)
create table if not exists public.ayah_audio (
  surah int not null,
  ayah int not null,
  qari text not null default 'husary_muallim_128kbps',
  audio_url text not null,
  timings_json jsonb,
  primary key (surah, ayah, qari),
  foreign key (surah, ayah) references public.ayahs (surah, ayah)
);

alter table public.ayah_audio enable row level security;

create policy "ayah_audio_read_all"
  on public.ayah_audio for select
  to authenticated, anon
  using (true);

-- Recite attempts (word-level ErrorLog)
create table if not exists public.ayah_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  surah int not null,
  ayah int not null,
  wer real,
  perfect boolean not null default false,
  hypothesis text,
  error_log jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ayah_attempts_user_created_idx
  on public.ayah_attempts (user_id, created_at desc);

alter table public.ayah_attempts enable row level security;

create policy "attempts_select_own"
  on public.ayah_attempts for select
  using (auth.uid() = user_id);

create policy "attempts_insert_own"
  on public.ayah_attempts for insert
  with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
