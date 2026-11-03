-- Stage 0 auth fields + admin helpers (Virtual Kuttab)
-- Extends 20261028170000_init.sql

-- Unique username + phone; optional age (never used as access gate)
alter table public.profiles
  add column if not exists username text,
  add column if not exists phone_e164 text,
  add column if not exists age int check (age is null or (age >= 1 and age <= 120));

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null;

create unique index if not exists profiles_phone_e164_uidx
  on public.profiles (phone_e164)
  where phone_e164 is not null;

-- Admin check without recursive RLS
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- Resolve email/username → auth email for login (Stage 0)
create or replace function public.resolve_login_email(identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  raw text := lower(trim(identifier));
  found_email text;
begin
  if raw is null or raw = '' then
    return null;
  end if;
  if position('@' in raw) > 0 then
    return raw;
  end if;
  select u.email into found_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username is not null
    and lower(p.username) = raw
  limit 1;
  return found_email;
end;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- Enrich profile from signup metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  role_in text := coalesce(meta->>'role', 'learner');
  uname text := nullif(trim(meta->>'username'), '');
  phone text := nullif(trim(meta->>'phone_e164'), '');
  dname text := coalesce(nullif(trim(meta->>'display_name'), ''), split_part(new.email, '@', 1));
  age_in int := null;
begin
  if role_in not in ('learner', 'parent', 'admin') then
    role_in := 'learner';
  end if;
  -- Public signup may never self-assign admin
  if role_in = 'admin' then
    role_in := 'learner';
  end if;
  begin
    if meta ? 'age' and nullif(trim(meta->>'age'), '') is not null then
      age_in := (meta->>'age')::int;
    end if;
  exception when others then
    age_in := null;
  end;

  insert into public.profiles (id, display_name, role, username, phone_e164, age, locale)
  values (
    new.id,
    dname,
    role_in,
    uname,
    phone,
    age_in,
    coalesce(nullif(trim(meta->>'locale'), ''), 'ar')
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    role = case
      when public.profiles.role = 'admin' then public.profiles.role
      else excluded.role
    end,
    username = coalesce(excluded.username, public.profiles.username),
    phone_e164 = coalesce(excluded.phone_e164, public.profiles.phone_e164),
    age = coalesce(excluded.age, public.profiles.age);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin can read all profiles / attempts
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "attempts_admin_select_all" on public.ayah_attempts;
create policy "attempts_admin_select_all"
  on public.ayah_attempts for select
  using (public.is_admin());

-- Username availability check (anon ok)
create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where username is not null
      and lower(username) = lower(trim(candidate))
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
