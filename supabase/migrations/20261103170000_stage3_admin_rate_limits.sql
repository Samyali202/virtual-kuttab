-- Stage 3: disable accounts + sliding-window rate limits + admin RPCs

alter table public.profiles
  add column if not exists disabled boolean not null default false;

create table if not exists public.rate_limits (
  bucket text primary key,
  hit_count int not null default 0 check (hit_count >= 0),
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
-- No direct client policies — only security definer RPCs

create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id) on delete set null,
  action text not null,
  target_user_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit enable row level security;

drop policy if exists "admin_audit_select" on public.admin_audit;
create policy "admin_audit_select"
  on public.admin_audit for select
  using (public.is_admin());

-- Returns true if allowed (and consumes one hit); false if over limit.
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_max int default 20,
  p_window_seconds int default 900
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.rate_limits%rowtype;
  now_ts timestamptz := now();
begin
  if p_bucket is null or length(trim(p_bucket)) < 3 then
    return false;
  end if;
  if p_max < 1 then p_max := 1; end if;
  if p_window_seconds < 30 then p_window_seconds := 30; end if;

  select * into rec from public.rate_limits where bucket = p_bucket for update;
  if not found then
    insert into public.rate_limits (bucket, hit_count, window_start)
    values (p_bucket, 1, now_ts);
    return true;
  end if;

  if now_ts - rec.window_start > make_interval(secs => p_window_seconds) then
    update public.rate_limits
    set hit_count = 1, window_start = now_ts
    where bucket = p_bucket;
    return true;
  end if;

  if rec.hit_count >= p_max then
    return false;
  end if;

  update public.rate_limits
  set hit_count = hit_count + 1
  where bucket = p_bucket;
  return true;
end;
$$;

revoke all on function public.consume_rate_limit(text, int, int) from public;
grant execute on function public.consume_rate_limit(text, int, int) to anon, authenticated;

create or replace function public.admin_set_user_disabled(
  p_user_id uuid,
  p_disabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_disable_self';
  end if;
  update public.profiles
  set disabled = coalesce(p_disabled, false)
  where id = p_user_id;
  if not found then
    return false;
  end if;
  insert into public.admin_audit (admin_id, action, target_user_id, meta)
  values (
    auth.uid(),
    case when p_disabled then 'disable_user' else 'enable_user' end,
    p_user_id,
    jsonb_build_object('disabled', p_disabled)
  );
  return true;
end;
$$;

revoke all on function public.admin_set_user_disabled(uuid, boolean) from public;
grant execute on function public.admin_set_user_disabled(uuid, boolean) to authenticated;

create or replace function public.admin_rate_limit_stats(p_limit int default 50)
returns table (
  bucket text,
  hit_count int,
  window_start timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only';
  end if;
  return query
  select r.bucket, r.hit_count, r.window_start
  from public.rate_limits r
  order by r.window_start desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

revoke all on function public.admin_rate_limit_stats(int) from public;
grant execute on function public.admin_rate_limit_stats(int) to authenticated;
