-- W06 #70 expansion: one optional snapshot, atomic with finalization.
begin;
create table public.inspection_locations (
  inspection_id uuid primary key references public.inspections(id) on delete cascade,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  captured_at timestamptz,
  constraint inspection_location_complete check (
    (latitude is null and longitude is null and accuracy is null and captured_at is null) or
    (latitude is not null and longitude is not null and accuracy is not null and captured_at is not null
      and latitude between -90 and 90 and longitude between -180 and 180
      and accuracy >= 0 and accuracy < 'Infinity'::double precision and isfinite(captured_at))
  )
);
alter table public.inspection_locations enable row level security;
revoke all on public.inspection_locations from public, anon, authenticated;
grant select on public.inspection_locations to authenticated;
create policy inspection_locations_coordinator_read on public.inspection_locations
for select to authenticated using (public.is_coordinator() and exists (
  select 1 from public.inspections i where i.id = inspection_id
    and i.workflow_status = 'completed' and i.deleted_at is null
));
-- Request bodies include GPS. Preserve receipt metadata/result reads without
-- allowing technicians to fetch their original sensitive request through REST.
revoke select on public.operation_receipts from authenticated;
grant select(actor_id, operation_id, client_id, operation_type, entity_type,
  entity_id, result, created_at) on public.operation_receipts to authenticated;

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
  v_finding public.findings%rowtype;
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
  if p_kind not in ('inspection.create','inspection.update','inspection.discard','inspection.finalize',
                    'finding.create','finding.update','finding.delete','finding.followup') then
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
    return v_receipt.result || jsonb_build_object('__replayed', true);
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
      if (p_payload - array['expectedFindingIds','location']) <> '{}'::jsonb or
        jsonb_typeof(p_payload -> 'expectedFindingIds') is distinct from 'array' then
        raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
      if p_payload ? 'location' and p_payload -> 'location' <> 'null'::jsonb then
        if jsonb_typeof(p_payload -> 'location') <> 'object' or
          ((p_payload -> 'location') - array['latitude','longitude','accuracy','capturedAt']) <> '{}'::jsonb or
          jsonb_typeof(p_payload #> '{location,latitude}') is distinct from 'number' or
          jsonb_typeof(p_payload #> '{location,longitude}') is distinct from 'number' or
          jsonb_typeof(p_payload #> '{location,accuracy}') is distinct from 'number' or
          jsonb_typeof(p_payload #> '{location,capturedAt}') is distinct from 'string' then
          raise exception 'INVALID_INPUT' using errcode = 'P0001';
        end if;
        if abs((p_payload #>> '{location,latitude}')::numeric) > 90 or
          abs((p_payload #>> '{location,longitude}')::numeric) > 180 or
          (p_payload #>> '{location,accuracy}')::numeric < 0 or
          (p_payload #>> '{location,capturedAt}') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' then
          raise exception 'INVALID_INPUT' using errcode = 'P0001';
        end if;
        begin
          perform (p_payload #>> '{location,capturedAt}')::timestamptz;
          perform (p_payload #>> '{location,accuracy}')::double precision;
        exception when others then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end;
      end if;
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
      insert into public.inspection_locations(inspection_id, latitude, longitude, accuracy, captured_at)
      values (p_entity_id, (p_payload #>> '{location,latitude}')::double precision,
        (p_payload #>> '{location,longitude}')::double precision,
        (p_payload #>> '{location,accuracy}')::double precision,
        (p_payload #>> '{location,capturedAt}')::timestamptz);

    end if;
    v_result := to_jsonb(v_inspection);

  elsif p_kind = 'finding.create' then
    if v_role <> 'technician' or p_base_version is not null or
      (p_payload - array['inspectionId','title','description','priority']) <> '{}'::jsonb then
      raise exception 'FORBIDDEN_OR_INVALID_INPUT' using errcode = 'P0001'; end if;
    select * into v_inspection from public.inspections
      where id = nullif(p_payload ->> 'inspectionId','')::uuid for update;
    if not found or v_inspection.inspector_id <> v_actor or v_inspection.workflow_status <> 'draft' or
      v_inspection.deleted_at is not null then raise exception 'NOT_EDITABLE' using errcode = 'P0001'; end if;
    insert into public.findings(id, client_id, inspection_id, title, description, priority, created_by, updated_by)
    values (p_entity_id, p_client_id, v_inspection.id,
      coalesce(p_payload ->> 'title',''), coalesce(p_payload ->> 'description',''),
      coalesce(nullif(p_payload ->> 'priority',''),'medium')::public.finding_priority, v_actor, v_actor)
      returning * into v_finding;
    v_result := to_jsonb(v_finding);

  elsif p_kind in ('finding.update','finding.delete','finding.followup') then
    -- Lock the parent inspection first so finding mutations serialize with
    -- inspection.finalize on the same row.
    select * into v_inspection from public.inspections i
      where i.id = (select f.inspection_id from public.findings f where f.id = p_entity_id) for update;
    select * into v_finding from public.findings where id = p_entity_id for update;
    if not found or v_finding.deleted_at is not null or v_inspection.deleted_at is not null then
      raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    if p_base_version is distinct from v_finding.version then
      raise exception 'VERSION_CONFLICT' using errcode = 'P0001'; end if;
    if p_kind = 'finding.followup' then
      if v_role <> 'coordinator' or v_inspection.workflow_status <> 'completed' or
        (p_payload - array['priority','status']) <> '{}'::jsonb then
        raise exception 'FORBIDDEN_OR_INVALID_INPUT' using errcode = 'P0001'; end if;
      if p_payload ? 'status' and (p_payload ->> 'status') <> v_finding.status::text and not (
        (v_finding.status = 'pending' and p_payload ->> 'status' = 'in_review') or
        (v_finding.status = 'in_review' and p_payload ->> 'status' = 'resolved')
      ) then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
      update public.findings set
        priority = case when p_payload ? 'priority' then (p_payload ->> 'priority')::public.finding_priority else priority end,
        status = case when p_payload ? 'status' then (p_payload ->> 'status')::public.finding_status else status end,
        resolved_at = case when p_payload ->> 'status' = 'resolved' then now() else resolved_at end,
        updated_by = v_actor where id = p_entity_id returning * into v_finding;
    else
      if v_role <> 'technician' or v_inspection.inspector_id <> v_actor or
        v_inspection.workflow_status <> 'draft' then
        raise exception 'NOT_EDITABLE' using errcode = 'P0001'; end if;
      if p_kind = 'finding.delete' then
        if p_payload <> '{}'::jsonb then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
        update public.findings set deleted_at = now(), updated_by = v_actor
          where id = p_entity_id returning * into v_finding;
      else
        if (p_payload - array['title','description','priority']) <> '{}'::jsonb then
          raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
        update public.findings set
          title = case when p_payload ? 'title' then coalesce(p_payload ->> 'title','') else title end,
          description = case when p_payload ? 'description' then coalesce(p_payload ->> 'description','') else description end,
          priority = case when p_payload ? 'priority' then (p_payload ->> 'priority')::public.finding_priority else priority end,
          updated_by = v_actor where id = p_entity_id returning * into v_finding;
      end if;
    end if;
    v_result := to_jsonb(v_finding);
  end if;

  update public.operation_receipts set result = v_result
    where actor_id = v_actor and operation_id = p_operation_id;
  return v_result || jsonb_build_object('__replayed', false);
end $function$;

revoke all on function public.apply_operation(uuid, uuid, text, uuid, integer, jsonb) from public, anon;
grant execute on function public.apply_operation(uuid, uuid, text, uuid, integer, jsonb) to authenticated;


commit;
