-- Phase 04: structural schema only. Business RPCs and read policies follow in phases 05–07.
-- Run as the Supabase project administrator on a new test project.
begin;

do $enum$ begin
  create type public.app_role as enum ('technician', 'coordinator');
exception when duplicate_object then null; end $enum$;
do $enum$ begin
  create type public.inspection_flow as enum ('draft', 'completed');
exception when duplicate_object then null; end $enum$;
do $enum$ begin
  create type public.finding_priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $enum$;
do $enum$ begin
  create type public.finding_status as enum ('pending', 'in_review', 'resolved');
exception when duplicate_object then null; end $enum$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Usuario de prueba'
    check (char_length(display_name) between 1 and 120),
  role public.app_role not null default 'technician',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.laboratories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 1 and 32),
  name text not null check (char_length(name) between 1 and 160),
  building text,
  floor text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspections (
  id uuid primary key,
  client_id uuid not null,
  folio_number bigint generated always as identity unique,
  laboratory_id uuid references public.laboratories(id) on delete restrict,
  inspector_id uuid not null references public.profiles(id) on delete restrict,
  inspection_date date,
  summary text not null default '' check (char_length(summary) <= 3000),
  workflow_status public.inspection_flow not null default 'draft',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  completed_at timestamptz,
  deleted_at timestamptz,
  constraint inspection_completion_consistent check (
    (workflow_status = 'draft' and completed_at is null)
    or (workflow_status = 'completed' and completed_at is not null and deleted_at is null)
  ),
  constraint inspection_completed_required check (
    workflow_status = 'draft' or
    (laboratory_id is not null and inspection_date is not null and char_length(btrim(summary)) > 0)
  )
);

create table if not exists public.findings (
  id uuid primary key,
  client_id uuid not null,
  inspection_id uuid not null references public.inspections(id) on delete restrict,
  title text not null default '' check (char_length(title) <= 160),
  description text not null default '' check (char_length(description) <= 3000),
  priority public.finding_priority not null default 'medium',
  status public.finding_status not null default 'pending',
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  deleted_at timestamptz,
  constraint finding_resolution_consistent check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null)
  )
);

create table if not exists public.operation_receipts (
  actor_id uuid not null references public.profiles(id) on delete restrict,
  operation_id uuid not null,
  client_id uuid not null,
  operation_type text not null,
  entity_type text not null check (entity_type in ('inspection', 'finding')),
  entity_id uuid not null,
  request_hash text not null,
  request_payload jsonb not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (actor_id, operation_id)
);

create index if not exists inspections_owner_date_idx
  on public.inspections(inspector_id, inspection_date desc, id);
create index if not exists inspections_date_idx
  on public.inspections(inspection_date desc, id);
create index if not exists inspections_lab_date_idx
  on public.inspections(laboratory_id, inspection_date desc);
create index if not exists inspections_client_idx
  on public.inspections(inspector_id, client_id);
create index if not exists findings_inspection_idx on public.findings(inspection_id);
create index if not exists findings_status_priority_idx
  on public.findings(status, priority, created_at desc, id);

create or replace function public.touch_record() returns trigger
language plpgsql set search_path = '' as $function$
begin
  new.updated_at := now();
  if tg_table_name in ('inspections', 'findings') then
    new.version := old.version + 1;
  end if;
  return new;
end $function$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_record();
drop trigger if exists laboratories_touch on public.laboratories;
create trigger laboratories_touch before update on public.laboratories
  for each row execute function public.touch_record();
drop trigger if exists inspections_touch on public.inspections;
create trigger inspections_touch before update on public.inspections
  for each row execute function public.touch_record();
drop trigger if exists findings_touch on public.findings;
create trigger findings_touch before update on public.findings
  for each row execute function public.touch_record();

-- User supplied metadata controls display name only. A new account is always technician.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $function$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 120), ''), 'Usuario de prueba'),
    'technician'
  )
  on conflict (id) do nothing;
  return new;
end $function$;

drop trigger if exists on_auth_user_created_pwa on auth.users;
create trigger on_auth_user_created_pwa after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing Auth users also start with the least privileged role.
insert into public.profiles (id, display_name, role)
select id,
  coalesce(nullif(left(btrim(raw_user_meta_data ->> 'display_name'), 120), ''), 'Usuario de prueba'),
  'technician'
from auth.users
on conflict (id) do nothing;

-- No access for app roles until policies and validated business RPCs are added.
alter table public.profiles enable row level security;
alter table public.laboratories enable row level security;
alter table public.inspections enable row level security;
alter table public.findings enable row level security;
alter table public.operation_receipts enable row level security;

revoke all on public.profiles, public.laboratories, public.inspections,
  public.findings, public.operation_receipts from public, anon, authenticated;
revoke all on function public.touch_record(), public.handle_new_user()
  from public, anon, authenticated;

commit;
