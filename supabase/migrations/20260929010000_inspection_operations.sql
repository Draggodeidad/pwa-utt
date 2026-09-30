-- Phase 05: inspection operations RPC with idempotent receipts and atomic
-- finalization. Incremental over the phase 04 structural schema; repeatable.
-- Run as the Supabase project administrator in SQL Editor after phase 04.
begin;

-- Business entry point. SECURITY DEFINER bypasses RLS, so every branch checks
-- auth.uid(), active profile, role, ownership, state, payload shape and
-- version. Finding kinds are rejected here and added in phase 06.
create or replace function public.apply_operation(
  p_operation_id uuid, p_client_id uuid, p_kind text, p_entity_id uuid,
  p_base_version integer, p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_request jsonb;
  v_hash text;
  v_new boolean := false;
  v_receipt public.operation_receipts%rowtype;
  v_inspection public.inspections%rowtype;
  v_expected text[];
  v_actual text[];
  v_result jsonb;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select p.role into v_role from public.profiles p where p.id = v_actor and p.active;
  if v_role is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_operation_id is null or p_client_id is null or p_entity_id is null or
    p_kind is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;
  -- Only inspection kinds exist in phase 05; finding kinds are INVALID_OPERATION.
  if p_kind not in ('inspection.create','inspection.update','inspection.discard','inspection.finalize') then
    raise exception 'INVALID_OPERATION' using errcode = 'P0001';
  end if;

  -- Full normalized request, not a partial key, decides idempotency.
  v_request := jsonb_build_object('kind', p_kind, 'entityId', p_entity_id,
    'clientId', p_client_id, 'baseVersion', p_base_version, 'payload', p_payload);
  v_hash := md5(v_request::text);
  insert into public.operation_receipts(actor_id, operation_id, client_id, operation_type, entity_type, entity_id, request_hash, request_payload)
  values (v_actor, p_operation_id, p_client_id, p_kind, split_part(p_kind, '.', 1), p_entity_id, v_hash, v_request)
  on conflict do nothing returning true into v_new;
  select * into v_receipt from public.operation_receipts
    where actor_id = v_actor and operation_id = p_operation_id for update;
  if not coalesce(v_new, false) then
    if v_receipt.request_payload <> v_request then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
    return v_receipt.result;
  end if;

  if p_kind = 'inspection.create' then
    if v_role <> 'technician' or p_base_version is not null or
      (p_payload - array['laboratoryId','inspectionDate','summary']) <> '{}'::jsonb then
      raise exception 'FORBIDDEN_OR_INVALID_INPUT' using errcode = 'P0001'; end if;
    if nullif(p_payload ->> 'laboratoryId','') is not null and not exists (
      select 1 from public.laboratories l where l.id = (p_payload ->> 'laboratoryId')::uuid and l.active
    ) then raise exception 'INVALID_LABORATORY' using errcode = 'P0001'; end if;
    insert into public.inspections(id, client_id, inspector_id, laboratory_id, inspection_date, summary, updated_by)
    values (p_entity_id, p_client_id, v_actor,
      nullif(p_payload ->> 'laboratoryId','')::uuid,
      nullif(p_payload ->> 'inspectionDate','')::date,
      coalesce(p_payload ->> 'summary',''), v_actor)
    returning * into v_inspection;
    v_result := to_jsonb(v_inspection);

  elsif p_kind in ('inspection.update','inspection.discard','inspection.finalize') then
    if v_role <> 'technician' then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
    select * into v_inspection from public.inspections where id = p_entity_id for update;
    if not found or v_inspection.inspector_id <> v_actor or v_inspection.deleted_at is not null then
      raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    if v_inspection.workflow_status <> 'draft' or p_base_version is distinct from v_inspection.version then
      raise exception 'VERSION_OR_STATE_CONFLICT' using errcode = 'P0001'; end if;
    if p_kind = 'inspection.update' then
      if (p_payload - array['laboratoryId','inspectionDate','summary']) <> '{}'::jsonb then
        raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
      if p_payload ? 'laboratoryId' and nullif(p_payload ->> 'laboratoryId','') is not null and not exists (
        select 1 from public.laboratories l where l.id = (p_payload ->> 'laboratoryId')::uuid and l.active
      ) then raise exception 'INVALID_LABORATORY' using errcode = 'P0001'; end if;
      update public.inspections set
        laboratory_id = case when p_payload ? 'laboratoryId' then nullif(p_payload ->> 'laboratoryId','')::uuid else laboratory_id end,
        inspection_date = case when p_payload ? 'inspectionDate' then nullif(p_payload ->> 'inspectionDate','')::date else inspection_date end,
        summary = case when p_payload ? 'summary' then coalesce(p_payload ->> 'summary','') else summary end,
        updated_by = v_actor where id = p_entity_id returning * into v_inspection;
    elsif p_kind = 'inspection.discard' then
      if p_payload <> '{}'::jsonb then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
      update public.inspections set deleted_at = now(), updated_by = v_actor
        where id = p_entity_id returning * into v_inspection;
    else
      if (p_payload - array['expectedFindingIds']) <> '{}'::jsonb or
        jsonb_typeof(p_payload -> 'expectedFindingIds') is distinct from 'array' then
        raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
      select coalesce(array_agg(e.value order by e.value), array[]::text[]) into v_expected
        from jsonb_array_elements_text(p_payload -> 'expectedFindingIds') e(value);
      select coalesce(array_agg(f.id::text order by f.id::text), array[]::text[]) into v_actual
        from public.findings f where f.inspection_id = p_entity_id and f.deleted_at is null;
      if v_expected <> v_actual then raise exception 'FINDING_SET_CONFLICT' using errcode = 'P0001'; end if;
      if v_inspection.laboratory_id is null or v_inspection.inspection_date is null or
        char_length(btrim(v_inspection.summary)) = 0 or
        exists (select 1 from public.findings f where f.inspection_id = p_entity_id
                and f.deleted_at is null and char_length(btrim(f.title)) = 0) then
        raise exception 'FINALIZATION_INVALID' using errcode = 'P0001'; end if;
      update public.inspections set workflow_status = 'completed', completed_at = now(), updated_by = v_actor
        where id = p_entity_id returning * into v_inspection;
    end if;
    v_result := to_jsonb(v_inspection);
  end if;

  update public.operation_receipts set result = v_result
    where actor_id = v_actor and operation_id = p_operation_id;
  return v_result;
end $function$;

revoke all on function public.apply_operation(uuid, uuid, text, uuid, integer, jsonb) from public, anon;
grant execute on function public.apply_operation(uuid, uuid, text, uuid, integer, jsonb) to authenticated;

commit; 