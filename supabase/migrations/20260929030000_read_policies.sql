-- Phase 07: read policies, role helpers and SELECT grants. Incremental over
-- phases 04-06; repeatable. Writes stay restricted to the validated RPC
-- (apply_operation): INSERT/UPDATE/DELETE are not granted to app roles.
-- Run as the Supabase project administrator in SQL Editor after phase 06.
begin;

-- Role helpers used by the read policies and by the app. SECURITY DEFINER so
-- the policy expressions can read the active profile regardless of the caller.
create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $function$
  select exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active);
$function$;
create or replace function public.is_coordinator() returns boolean
language sql stable security definer set search_path = '' as $function$
  select exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and p.role = 'coordinator');
$function$;
create or replace function public.is_technician() returns boolean
language sql stable security definer set search_path = '' as $function$
  select exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and p.role = 'technician');
$function$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (public.is_active_user() and (id = (select auth.uid()) or public.is_coordinator()));
drop policy if exists laboratories_read on public.laboratories;
create policy laboratories_read on public.laboratories for select to authenticated
using (active and public.is_active_user());
drop policy if exists inspections_read on public.inspections;
create policy inspections_read on public.inspections for select to authenticated
using (deleted_at is null and public.is_active_user() and
  (inspector_id = (select auth.uid()) or (public.is_coordinator() and workflow_status = 'completed')));
drop policy if exists findings_read on public.findings;
create policy findings_read on public.findings for select to authenticated
using (deleted_at is null and public.is_active_user() and exists (
  select 1 from public.inspections i where i.id = findings.inspection_id
  and i.deleted_at is null and
  (i.inspector_id = (select auth.uid()) or (public.is_coordinator() and i.workflow_status = 'completed'))
));
drop policy if exists receipts_read on public.operation_receipts;
create policy receipts_read on public.operation_receipts for select to authenticated
using (actor_id = (select auth.uid()) and public.is_active_user());

-- Reads only; writes remain exclusive to apply_operation (revoked in phase 04).
grant select on public.profiles, public.laboratories, public.inspections,
  public.findings, public.operation_receipts to authenticated;

revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_coordinator() from public, anon;
revoke all on function public.is_technician() from public, anon;
grant execute on function public.is_active_user(), public.is_coordinator(), public.is_technician() to authenticated;

commit;