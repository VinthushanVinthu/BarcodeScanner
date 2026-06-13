-- Run this file in the Supabase SQL Editor.
-- Default admin signup code: 0773417017

create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sections_name_not_blank check (length(trim(name)) > 0)
);

create table if not exists public.label_scans (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete restrict,
  label_date date not null default current_date,
  barcode text,
  sew text,
  cut text,
  so text,
  li text,
  ref text,
  vd text,
  sg3 text,
  color text,
  item text,
  size text,
  line_num text,
  bin text,
  parsed_data jsonb not null default '{}'::jsonb,
  raw_text text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.label_scans
  add column if not exists label_date date not null default current_date;

create index if not exists idx_sections_active_sort
  on public.sections(is_active, sort_order, name);

create index if not exists idx_label_scans_section_created
  on public.label_scans(section_id, created_at desc);

create index if not exists idx_label_scans_label_date_section
  on public.label_scans(label_date desc, section_id);

create index if not exists idx_label_scans_barcode
  on public.label_scans(barcode);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sections_updated_at on public.sections;
create trigger set_sections_updated_at
before update on public.sections
for each row execute function public.set_updated_at();

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where id = user_id
  );
$$;

grant execute on function public.is_admin(uuid) to anon, authenticated;

create or replace function public.can_insert_label_scan(target_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sections
    where id = target_section_id
      and is_active = true
  );
$$;

grant execute on function public.can_insert_label_scan(uuid) to anon, authenticated;

create or replace function public.validate_admin_signup_code()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'admin_code', '') <> '0773417017' then
    raise exception 'Invalid admin code';
  end if;

  new.raw_user_meta_data = coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'admin_code';
  return new;
end;
$$;

drop trigger if exists validate_admin_signup_code on auth.users;
create trigger validate_admin_signup_code
before insert on auth.users
for each row execute function public.validate_admin_signup_code();

create or replace function public.create_admin_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.admin_profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists create_admin_profile on auth.users;
create trigger create_admin_profile
after insert on auth.users
for each row execute function public.create_admin_profile();

alter table public.admin_profiles enable row level security;
alter table public.sections enable row level security;
alter table public.label_scans enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.sections to anon, authenticated;
grant insert on public.label_scans to anon, authenticated;
grant select, insert, update, delete on public.sections to authenticated;
grant select, update, delete on public.label_scans to anon, authenticated;
grant select on public.admin_profiles to authenticated;

drop policy if exists "Admins can view admin profiles" on public.admin_profiles;
create policy "Admins can view admin profiles"
on public.admin_profiles
for select
to authenticated
using (public.is_admin());

drop policy if exists "Anyone can view active sections" on public.sections;
drop policy if exists "Anyone can view sections" on public.sections;
create policy "Anyone can view sections"
on public.sections
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can create sections" on public.sections;
create policy "Admins can create sections"
on public.sections
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update sections" on public.sections;
create policy "Admins can update sections"
on public.sections
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete sections" on public.sections;
create policy "Admins can delete sections"
on public.sections
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Anyone can save scans for active sections" on public.label_scans;
create policy "Anyone can save scans for active sections"
on public.label_scans
for insert
to anon, authenticated
with check (public.can_insert_label_scan(section_id));

drop policy if exists "Admins can view all scans" on public.label_scans;
drop policy if exists "Anyone can view all scans" on public.label_scans;
create policy "Anyone can view all scans"
on public.label_scans
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can update scans" on public.label_scans;
drop policy if exists "Anyone can update scans" on public.label_scans;
create policy "Anyone can update scans"
on public.label_scans
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Admins can delete scans" on public.label_scans;
drop policy if exists "Anyone can delete scans" on public.label_scans;
create policy "Anyone can delete scans"
on public.label_scans
for delete
to anon, authenticated
using (true);

-- Optional starter section. Delete this block if you want the first admin to create every section manually.
insert into public.sections (name, description, sort_order)
select 'General Production', 'Default section for saved label scans.', 1
where not exists (select 1 from public.sections);
