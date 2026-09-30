-- Phase 05 integration checks for inspection operations. Run in the test
-- project's SQL Editor AFTER applying 20260929010000_inspection_operations.sql
-- twice (repeatability). Synthetic Auth accounts and rows are rolled back.
-- Simulates authenticated JWTs via request.jwt.claims + set local role. RPC
-- calls run as authenticated; read assertions run as admin because phase 04
-- intentionally revoked table reads until the phase 07 policies.
begin;

do $test$
declare
  v_tec_a uuid := gen_random_uuid();
  v_tec_b uuid := gen_random_uuid();
  v_coord uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_lab uuid := '11111111-1111-4111-8111-111111111111';
  v_insp1 uuid := gen_random_uuid();
  v_insp2 uuid := gen_random_uuid();
  v_insp3 uuid := gen_random_uuid();
  v_insp4 uuid := gen_random_uuid();
  v_f1 uuid := gen_random_uuid();
  v_f2 uuid := gen_random_uuid();
  v_f5 uuid := gen_random_uuid();
  v_op uuid;
  v_result jsonb;
  v_prev jsonb;
  v_state public.inspection_flow;
  v_ver integer;
  v_bad boolean;
begin
  -- Admin setup: three synthetic Auth accounts; the trigger creates technician
  -- profiles; only the coordinator profile is elevated in this transaction.
  insert into auth.users (id, raw_user_meta_data)
  values (v_tec_a, '{}'::jsonb), (v_tec_b, '{}'::jsonb), (v_coord, '{}'::jsonb);
  if (select count(*) from public.profiles
      where id in (v_tec_a, v_tec_b, v_coord) and role = 'technician') <> 3 then
    raise exception 'Synthetic profiles were not created as technician';
  end if;
  update public.profiles set role = 'coordinator' where id = v_coord;
  if (select role from public.profiles where id = v_coord) <> 'coordinator' then
    raise exception 'Coordinator elevation failed';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_a::text, 'role', 'authenticated')::text, true);

  -- C1: technician creates a draft; ACK carries version 1, server folio and a
  -- non-null receipt result committed in the same transaction.
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'inspection.create', v_insp1, null,
    jsonb_build_object('laboratoryId', v_lab, 'inspectionDate', current_date::text, 'summary', 'Borrador A'));
  if v_result ->> 'version' <> '1' then raise exception 'Create did not return version 1'; end if;
  if (v_result ->> 'workflow_status') <> 'draft' then raise exception 'Create is not a draft'; end if;
  if v_result ? 'folio_number' = false then raise exception 'Create did not assign a server folio'; end if;
  reset role;
  if (select result is null from public.operation_receipts
      where actor_id = v_tec_a and operation_id = v_op) then
    raise exception 'Confirmed receipt left a null result';
  end if;
  set local role authenticated;

  -- C2: same operation + same normalized payload returns the original ACK and
  -- does not advance the entity version.
  v_prev := v_result;
  v_result := public.apply_operation(v_op, v_client, 'inspection.create', v_insp1, null,
    jsonb_build_object('laboratoryId', v_lab, 'inspectionDate', current_date::text, 'summary', 'Borrador A'));
  if v_result is distinct from v_prev then raise exception 'Replay did not return the original ACK'; end if;
  reset role;
  select version into v_ver from public.inspections where id = v_insp1;
  if v_ver <> 1 then raise exception 'Replay advanced the inspection version'; end if;
  set local role authenticated;

  -- C3: same operation id with different payload -> IDEMPOTENCY_KEY_REUSED.
  v_bad := false;
  begin
    perform public.apply_operation(v_op, v_client, 'inspection.create', v_insp1, null,
      jsonb_build_object('laboratoryId', v_lab, 'inspectionDate', current_date::text, 'summary', 'Cambiado'));
  exception when others then
    if SQLERRM <> 'IDEMPOTENCY_KEY_REUSED' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Idempotency key reused with different payload was accepted'; end if;

  -- C4: another operation id on an existing entity neither duplicates it nor
  -- leaves a receipt behind.
  v_op := gen_random_uuid();
  v_bad := false;
  begin
    perform public.apply_operation(v_op, v_client, 'inspection.create', v_insp1, null,
      jsonb_build_object('laboratoryId', v_lab, 'inspectionDate', current_date::text, 'summary', 'Duplicado'));
  exception when others then v_bad := true;
  end;
  if not v_bad then raise exception 'Duplicate entity create was accepted'; end if;
  reset role;
  if exists (select 1 from public.operation_receipts
      where actor_id = v_tec_a and operation_id = v_op) then
    raise exception 'Failed duplicate left a receipt';
  end if;
  set local role authenticated;

  -- C5: update with the current version succeeds and bumps to version 2.
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'inspection.update', v_insp1, 1,
    jsonb_build_object('summary', 'Borrador A actualizado'));
  if v_result ->> 'version' <> '2' then raise exception 'Update did not bump version to 2'; end if;

  -- C6: a second edit with the same baseVersion conflicts.
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.update', v_insp1, 1,
      jsonb_build_object('summary', 'Stale'));
  exception when others then
    if SQLERRM <> 'VERSION_OR_STATE_CONFLICT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Stale update was accepted'; end if;

  -- C7: a foreign technician gets no data and leaves no receipt.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_b::text, 'role', 'authenticated')::text, true);
  v_op := gen_random_uuid();
  v_bad := false;
  begin
    perform public.apply_operation(v_op, v_client, 'inspection.update', v_insp1, 2,
      jsonb_build_object('summary', 'Ajeno'));
  exception when others then
    if SQLERRM <> 'NOT_FOUND' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Foreign technician reached the resource'; end if;
  reset role;
  if exists (select 1 from public.operation_receipts
      where actor_id = v_tec_b and operation_id = v_op) then
    raise exception 'Failed foreign operation left a receipt';
  end if;
  set local role authenticated;

  -- C8: a coordinator cannot create inspections.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_coord::text, 'role', 'authenticated')::text, true);
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.create',
      gen_random_uuid(), null, '{}'::jsonb);
  exception when others then
    if SQLERRM <> 'FORBIDDEN_OR_INVALID_INPUT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Coordinator created an inspection'; end if;

  -- C9: owner/audit fields are never accepted from the payload.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_a::text, 'role', 'authenticated')::text, true);
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.update', v_insp1, 2,
      jsonb_build_object('inspector_id', v_tec_a, 'version', 1));
  exception when others then
    if SQLERRM <> 'INVALID_INPUT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Audit/owner fields accepted in update payload'; end if;
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.create',
      gen_random_uuid(), null, jsonb_build_object('inspector_id', v_tec_a, 'created_at', now()));
  exception when others then
    if SQLERRM <> 'FORBIDDEN_OR_INVALID_INPUT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Audit/owner fields accepted in create payload'; end if;

  -- C9b: discard with a non-empty payload is invalid (checked before discarding).
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.discard', v_insp1, 2,
      jsonb_build_object('summary', 'No'));
  exception when others then
    if SQLERRM <> 'INVALID_INPUT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Discard with payload was accepted'; end if;

  -- C10: discard is logical and marks deleted_at.
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'inspection.discard', v_insp1, 2, '{}'::jsonb);
  if (v_result ->> 'deleted_at') is null then raise exception 'Discard did not set deleted_at'; end if;

  -- C11: no resurrection after discard (update, finalize and create are denied).
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.update', v_insp1, 3,
      jsonb_build_object('summary', 'Resucitar'));
  exception when others then
    if SQLERRM <> 'NOT_FOUND' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Discarded inspection was editable'; end if;
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.create', v_insp1, null, '{}'::jsonb);
  exception when others then v_bad := true;
  end;
  if not v_bad then raise exception 'Discarded inspection was recreated'; end if;

  -- C12: finding kinds are rejected until phase 06, without mutating anything.
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.create',
      gen_random_uuid(), null, jsonb_build_object('inspectionId', v_insp1));
  exception when others then
    if SQLERRM <> 'INVALID_OPERATION' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Finding kind was accepted before phase 06'; end if;

  -- Finalization: create a second draft, add findings as administrator, then
  -- finalize as the technician. Admin inserts bypass RLS as table owner.
  v_op := gen_random_uuid();
  perform public.apply_operation(v_op, v_client, 'inspection.create', v_insp2, null,
    jsonb_build_object('laboratoryId', v_lab, 'inspectionDate', current_date::text, 'summary', 'A finalizar'));
  reset role;
  insert into public.findings (id, client_id, inspection_id, title, description, priority, created_by, updated_by)
  values
    (v_f1, v_client, v_insp2, 'Hallazgo 1', '', 'medium', v_tec_a, v_tec_a),
    (v_f2, v_client, v_insp2, 'Hallazgo 2', '', 'high', v_tec_a, v_tec_a);
  set local role authenticated;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_a::text, 'role', 'authenticated')::text, true);

  -- C13: wrong expected finding set -> FINDING_SET_CONFLICT with no receipt and
  -- no state change.
  v_op := gen_random_uuid();
  v_bad := false;
  begin
    perform public.apply_operation(v_op, v_client, 'inspection.finalize', v_insp2, 1,
      jsonb_build_object('expectedFindingIds', jsonb_build_array(v_f1)));
  exception when others then
    if SQLERRM <> 'FINDING_SET_CONFLICT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Finalization with a wrong finding set was accepted'; end if;
  reset role;
  if exists (select 1 from public.operation_receipts
      where actor_id = v_tec_a and operation_id = v_op) then
    raise exception 'Finalization conflict left a receipt';
  end if;
  select workflow_status into v_state from public.inspections where id = v_insp2;
  if v_state <> 'draft' then raise exception 'Finalization conflict changed the state'; end if;
  set local role authenticated;

  -- C14: exact expected set -> atomic completion with ACK and receipt result.
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'inspection.finalize', v_insp2, 1,
    jsonb_build_object('expectedFindingIds', jsonb_build_array(v_f1, v_f2)));
  if (v_result ->> 'workflow_status') <> 'completed' or (v_result ->> 'completed_at') is null then
    raise exception 'Finalize did not complete the inspection'; end if;
  reset role;
  if (select result is null from public.operation_receipts
      where actor_id = v_tec_a and operation_id = v_op) then
    raise exception 'Finalize receipt left a null result';
  end if;
  set local role authenticated;

  -- C15: a completed inspection cannot be finalized again.
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.finalize', v_insp2, 2, '{}'::jsonb);
  exception when others then
    if SQLERRM <> 'VERSION_OR_STATE_CONFLICT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Completed inspection was finalized again'; end if;

  -- C16: an empty draft cannot be finalized.
  v_op := gen_random_uuid();
  perform public.apply_operation(v_op, v_client, 'inspection.create', v_insp3, null, '{}'::jsonb);
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.finalize', v_insp3, 1,
      jsonb_build_object('expectedFindingIds', '[]'::jsonb));
  exception when others then
    if SQLERRM <> 'FINALIZATION_INVALID' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Empty draft was finalized'; end if;
  reset role;
  if exists (select 1 from public.operation_receipts
      where operation_type = 'inspection.finalize' and entity_id = v_insp3) then
    raise exception 'Invalid finalization left a receipt';
  end if;
  set local role authenticated;

  -- C17: with required fields and zero findings, finalization completes.
  v_op := gen_random_uuid();
  perform public.apply_operation(v_op, v_client, 'inspection.update', v_insp3, 1,
    jsonb_build_object('laboratoryId', v_lab, 'inspectionDate', current_date::text, 'summary', 'Sin hallazgos'));
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'inspection.finalize', v_insp3, 2,
    jsonb_build_object('expectedFindingIds', '[]'::jsonb));
  if (v_result ->> 'workflow_status') <> 'completed' then
    raise exception 'Zero-finding finalize failed';
  end if;

  -- C18: a non-deleted finding with an empty title blocks finalization.
  v_op := gen_random_uuid();
  perform public.apply_operation(v_op, v_client, 'inspection.create', v_insp4, null,
    jsonb_build_object('laboratoryId', v_lab, 'inspectionDate', current_date::text, 'summary', 'Con hallazgo vacío'));
  reset role;
  insert into public.findings (id, client_id, inspection_id, title, description, priority, created_by, updated_by)
  values (v_f5, v_client, v_insp4, '', '', 'medium', v_tec_a, v_tec_a);
  set local role authenticated;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_a::text, 'role', 'authenticated')::text, true);
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.finalize', v_insp4, 1,
      jsonb_build_object('expectedFindingIds', jsonb_build_array(v_f5)));
  exception when others then
    if SQLERRM <> 'FINALIZATION_INVALID' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Empty-titled finding was finalized'; end if;
  reset role;
  if exists (select 1 from public.operation_receipts
      where entity_id = v_insp4 and operation_type = 'inspection.finalize' and result is not null) then
    raise exception 'Invalid finalization recorded an ACK';
  end if;
  set local role authenticated;

  -- C19: finalize rejects extra payload keys.
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.finalize', v_insp4, 1,
      jsonb_build_object('expectedFindingIds', jsonb_build_array(v_f5), 'summary', 'extra'));
  exception when others then
    if SQLERRM <> 'INVALID_INPUT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Finalize with extra keys was accepted'; end if;

  -- C20: anon has no EXECUTE on the RPC.
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_a::text, 'role', 'anon')::text, true);
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.create',
      gen_random_uuid(), null, '{}'::jsonb);
  exception when insufficient_privilege then v_bad := true;
  end;
  if not v_bad then raise exception 'Anon executed apply_operation'; end if;
  reset role;

  -- C21: grants are correct and phase 07 read policies are still absent.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'apply_operation') <> 1 then
    raise exception 'apply_operation function is missing';
  end if;
  if has_function_privilege('anon', 'public.apply_operation(uuid,uuid,text,uuid,integer,jsonb)', 'EXECUTE') then
    raise exception 'Anon can execute apply_operation';
  end if;
  if not has_function_privilege('authenticated', 'public.apply_operation(uuid,uuid,text,uuid,integer,jsonb)', 'EXECUTE') then
    raise exception 'Authenticated cannot execute apply_operation';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public') then
    raise exception 'Read policies belong to phase 07';
  end if;
end $test$;

rollback;
select 'phase-05 inspection operations passed' as result;