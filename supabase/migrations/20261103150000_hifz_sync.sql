-- Stage 1: cross-device Hifz bookmark + stats sync

create table if not exists public.hifz_bookmarks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  surah int not null check (surah between 1 and 114),
  ayah int not null check (ayah >= 1),
  perfect boolean,
  bad_count int not null default 0 check (bad_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.hifz_bookmarks enable row level security;

drop policy if exists "bookmarks_select_own" on public.hifz_bookmarks;
create policy "bookmarks_select_own"
  on public.hifz_bookmarks for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "bookmarks_upsert_own" on public.hifz_bookmarks;
create policy "bookmarks_insert_own"
  on public.hifz_bookmarks for insert
  with check (auth.uid() = user_id);

drop policy if exists "bookmarks_update_own" on public.hifz_bookmarks;
create policy "bookmarks_update_own"
  on public.hifz_bookmarks for update
  using (auth.uid() = user_id);

create table if not exists public.hifz_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  streak int not null default 0 check (streak >= 0),
  last_active_day date,
  today_count int not null default 0 check (today_count >= 0),
  today_day date,
  total_scores int not null default 0 check (total_scores >= 0),
  updated_at timestamptz not null default now()
);

alter table public.hifz_stats enable row level security;

drop policy if exists "stats_select_own" on public.hifz_stats;
create policy "stats_select_own"
  on public.hifz_stats for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "stats_insert_own" on public.hifz_stats;
create policy "stats_insert_own"
  on public.hifz_stats for insert
  with check (auth.uid() = user_id);

drop policy if exists "stats_update_own" on public.hifz_stats;
create policy "stats_update_own"
  on public.hifz_stats for update
  using (auth.uid() = user_id);
