-- Coordination is separate from technical completion and finding follow-up.
-- No data or Storage object is physically deleted. Apply after inspection_locations.
begin;

alter table public.inspections
  add column if not exists review_status text not null default 'pending',
  add column if not exists review_notes text not null default '',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete restrict,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete restrict,
  add column if not exists deleted_by uuid references public.profiles(id) on delete restrict;

alter table public.inspections drop constraint if exists inspection_completion_consistent;
alter table public.inspections add constraint inspection_completion_consistent check (
  (workflow_status = 'draft' and completed_at is null) or
  (workflow_status = 'completed' and completed_at is not null)
);
alter table public.inspections drop constraint if exists inspection_coordination_consistent;
alter table public.inspections add constraint inspection_coordination_consistent check (
  char_length(review_notes) <= 2000 and
  ((review_status = 'pending' and reviewed_at is null and reviewed_by is null and review_notes = '') or
   (review_status in ('approved','rejected') and workflow_status = 'completed'
    and reviewed_at is not null and reviewed_by is not null
    and (review_status <> 'rejected' or char_length(btrim(review_notes)) > 0))) and
  ((archived_at is null and archived_by is null) or
   (archived_at is not null and archived_by is not null and review_status <> 'pending'))
);
-- Date/UUID ordering matches the existing cursor. Defaults leave old rows active/unreviewed.
create index if not exists inspections_active_coordination_idx
  on public.inspections(inspection_date desc, id desc)
  where workflow_status = 'completed' and deleted_at is null and archived_at is null;
create index if not exists inspections_archive_coordination_idx
  on public.inspections(inspection_date desc, id desc)
  where workflow_status = 'completed' and deleted_at is null and archived_at is not null;

-- In particular, a former technician promoted to coordinator cannot read their old drafts.
drop policy if exists inspections_read on public.inspections;
create policy inspections_read on public.inspections for select to authenticated using (
  deleted_at is null and
  ((public.is_technician() and inspector_id = (select auth.uid())) or
   (public.is_coordinator() and workflow_status = 'completed'))
);
drop policy if exists findings_read on public.findings;
create policy findings_read on public.findings for select to authenticated using (
  deleted_at is null and exists(select 1 from public.inspections i where i.id = findings.inspection_id)
);
create or replace function public.can_read_finding_photo(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.finding_photos p
    join public.findings f on f.id = p.finding_id and f.inspection_id = p.inspection_id
    join public.inspections i on i.id = p.inspection_id
    where p.id = p_id and p.state <> 'deleted' and f.deleted_at is null and i.deleted_at is null and (
      public.is_technician() and p.owner_user_id = auth.uid() and i.inspector_id = auth.uid()
      or public.is_coordinator() and i.workflow_status = 'completed' and p.state = 'uploaded'));
$$;

-- Preserve the draft cleanup/finalization guards. Completed evidence stays physically intact.
create or replace function public.guard_photo_parent_mutation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'inspections' then
    if new.workflow_status = 'completed' and old.workflow_status <> 'completed' and exists (
      select 1 from public.finding_photos p where p.inspection_id = new.id and p.state in ('pending','deleting')) then
      raise exception 'PHOTOS_PENDING'; end if;
    if old.workflow_status = 'draft' and new.deleted_at is not null and old.deleted_at is null and exists (
      select 1 from public.finding_photos p where p.inspection_id = new.id and p.state <> 'deleted') then
      raise exception 'PHOTOS_PENDING'; end if;
  else
    if new.deleted_at is not null and old.deleted_at is null and exists (
      select 1 from public.finding_photos p where p.finding_id = new.id and p.state <> 'deleted') then
      raise exception 'PHOTOS_PENDING'; end if;
  end if;
  return new;
end $$;

-- The legacy follow-up RPC locks the parent before writing a finding. This trigger
-- also blocks it after archive/delete without replacing the offline RPC/contracts.
create or replace function public.guard_coordination_lifecycle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'findings' then
    if exists(select 1 from public.inspections i where i.id = new.inspection_id
      and (i.archived_at is not null or i.deleted_at is not null)) then
      raise exception 'VERSION_OR_STATE_CONFLICT'; end if;
  else
    if old.deleted_at is not null then raise exception 'NOT_FOUND'; end if;
    if old.review_status <> 'pending' and
      (new.review_status, new.review_notes, new.reviewed_at, new.reviewed_by) is distinct from
      (old.review_status, old.review_notes, old.reviewed_at, old.reviewed_by) then
      raise exception 'VERSION_OR_STATE_CONFLICT'; end if;
    if new.deleted_at is not null and old.deleted_at is null then new.deleted_by := auth.uid(); end if;
  end if;
  return new;
end $$;
drop trigger if exists inspections_coordination_guard on public.inspections;
create trigger inspections_coordination_guard before update on public.inspections
  for each row execute function public.guard_coordination_lifecycle();
drop trigger if exists findings_coordination_guard on public.findings;
create trigger findings_coordination_guard before insert or update on public.findings
  for each row execute function public.guard_coordination_lifecycle();

-- Only entry point for coordination writes. Authenticated has SELECT, no table DML.
-- SECURITY DEFINER is narrowly scoped: explicit identity/role, completed-only,
-- allowlisted fields, row lock, expected version and shared durable receipt.
create or replace function public.coordinate_inspection(
  p_operation_id uuid, p_inspection_id uuid, p_base_version integer,
  p_action text, p_notes text default '', p_confirmation text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_inspection public.inspections%rowtype;
  v_receipt public.operation_receipts%rowtype;
  v_request jsonb;
  v_result jsonb;
  v_new boolean := false;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_profile from public.profiles where id = v_actor for share;
  if not found or not v_profile.active or v_profile.role <> 'coordinator' then raise exception 'FORBIDDEN'; end if;
  if p_operation_id is null or p_inspection_id is null or p_base_version is null or p_base_version < 1 or
    p_action is null or p_action not in ('approve','reject','archive','unarchive','delete') or
    p_notes is null or char_length(p_notes) > 2000 or p_confirmation is null or
    (p_action = 'reject' and char_length(btrim(p_notes)) = 0) or
    (p_action not in ('approve','reject') and p_notes <> '') or
    (p_action <> 'delete' and p_confirmation <> '') then raise exception 'INVALID_INPUT'; end if;
  v_request := jsonb_build_object('inspectionId',p_inspection_id,'baseVersion',p_base_version,
    'action',p_action,'notes',p_notes,'confirmation',p_confirmation);
  insert into public.operation_receipts(actor_id,operation_id,client_id,operation_type,entity_type,entity_id,request_hash,request_payload)
    values(v_actor,p_operation_id,p_operation_id,'coordination.' || p_action,'inspection',p_inspection_id,md5(v_request::text),v_request)
    on conflict do nothing returning true into v_new;
  select * into v_receipt from public.operation_receipts
    where actor_id = v_actor and operation_id = p_operation_id for update;
  if not coalesce(v_new,false) then
    if v_receipt.request_payload <> v_request then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return v_receipt.result || jsonb_build_object('replayed',true);
  end if;
  select * into v_inspection from public.inspections where id = p_inspection_id for update;
  if not found or v_inspection.deleted_at is not null or v_inspection.workflow_status <> 'completed' then raise exception 'NOT_FOUND'; end if;
  if p_base_version <> v_inspection.version then raise exception 'VERSION_CONFLICT'; end if;
  if p_action in ('approve','reject') then
    if v_inspection.review_status <> 'pending' or v_inspection.archived_at is not null then raise exception 'VERSION_OR_STATE_CONFLICT'; end if;
    update public.inspections set review_status = case when p_action = 'approve' then 'approved' else 'rejected' end,
      review_notes = btrim(p_notes), reviewed_at = now(), reviewed_by = v_actor, updated_by = v_actor
      where id = p_inspection_id returning * into v_inspection;
  elsif p_action = 'archive' then
    if v_inspection.review_status = 'pending' then raise exception 'VERSION_OR_STATE_CONFLICT'; end if;
    if v_inspection.archived_at is null then
      update public.inspections set archived_at = now(), archived_by = v_actor, updated_by = v_actor
        where id = p_inspection_id returning * into v_inspection;
    end if;
  elsif p_action = 'unarchive' then
    if v_inspection.review_status = 'pending' then raise exception 'VERSION_OR_STATE_CONFLICT'; end if;
    if v_inspection.archived_at is not null then
      update public.inspections set archived_at = null, archived_by = null, updated_by = v_actor
        where id = p_inspection_id returning * into v_inspection;
    end if;
  else
    if p_confirmation <> 'INS-' || v_inspection.folio_number::text then raise exception 'INVALID_CONFIRMATION'; end if;
    if v_inspection.archived_at is null and v_inspection.review_status <> 'rejected' then raise exception 'VERSION_OR_STATE_CONFLICT'; end if;
    update public.inspections set deleted_at = now(), deleted_by = v_actor, updated_by = v_actor
      where id = p_inspection_id returning * into v_inspection;
  end if;
  v_result := jsonb_build_object('id',v_inspection.id,'version',v_inspection.version,
    'reviewStatus',v_inspection.review_status,'reviewNotes',v_inspection.review_notes,
    'reviewedAt',v_inspection.reviewed_at,'reviewedBy',v_inspection.reviewed_by,'archivedBy',v_inspection.archived_by,'archivedAt',v_inspection.archived_at,
    'deletedAt',v_inspection.deleted_at,'replayed',false);
  update public.operation_receipts set result = v_result where actor_id = v_actor and operation_id = p_operation_id;
  return v_result;
end $$;
revoke all on function public.guard_coordination_lifecycle() from public, anon, authenticated;
revoke all on function public.coordinate_inspection(uuid,uuid,integer,text,text,text) from public, anon;
grant execute on function public.coordinate_inspection(uuid,uuid,integer,text,text,text) to authenticated;
commit;
