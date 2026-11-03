-- Stage 2: parent ↔ kid links + parent read access to kid progress

create table if not exists public.family_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  child_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint family_links_parent_child_uidx unique (parent_id, child_id),
  constraint family_links_no_self check (parent_id <> child_id)
);

create index if not exists family_links_parent_idx on public.family_links (parent_id);
create index if not exists family_links_child_idx on public.family_links (child_id);

alter table public.family_links enable row level security;

drop policy if exists "family_select_own" on public.family_links;
create policy "family_select_own"
  on public.family_links for select
  using (
    auth.uid() = parent_id
    or auth.uid() = child_id
    or public.is_admin()
  );

-- Inserts/deletes only via Edge Functions (service role) — no client insert policy

create or replace function public.is_parent_of(child uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_links
    where parent_id = auth.uid() and child_id = child
  );
$$;

revoke all on function public.is_parent_of(uuid) from public;
grant execute on function public.is_parent_of(uuid) to authenticated;

drop policy if exists "profiles_parent_select_kids" on public.profiles;
create policy "profiles_parent_select_kids"
  on public.profiles for select
  using (public.is_parent_of(id));

drop policy if exists "bookmarks_parent_select_kids" on public.hifz_bookmarks;
create policy "bookmarks_parent_select_kids"
  on public.hifz_bookmarks for select
  using (public.is_parent_of(user_id));

drop policy if exists "stats_parent_select_kids" on public.hifz_stats;
create policy "stats_parent_select_kids"
  on public.hifz_stats for select
  using (public.is_parent_of(user_id));

drop policy if exists "attempts_parent_select_kids" on public.ayah_attempts;
create policy "attempts_parent_select_kids"
  on public.ayah_attempts for select
  using (public.is_parent_of(user_id));
