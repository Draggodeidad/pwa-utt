-- Phase 06 integration checks for finding operations. Run in the test
-- project's SQL Editor AFTER applying 20260929020000_finding_operations.sql
-- twice (repeatability). Synthetic Auth accounts and rows are rolled back.
-- RPC calls run as authenticated (request.jwt.claims + set local role); read
-- assertions run as admin because phase 04 revoked table reads until phase 07.
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
  v_f1 uuid := gen_random_uuid();
  v_f2 uuid := gen_random_uuid();
  v_f3 uuid := gen_random_uuid();
  v_f4 uuid := gen_random_uuid();
  v_f5 uuid := gen_random_uuid();
  v_f6 uuid := gen_random_uuid();
  v_op uuid;
  v_result jsonb;
  v_prev jsonb;
  v_state public.inspection_flow;
  v_ver integer;
  v_ts timestamptz;
  v_bad boolean;
begin
  -- Admin setup: three synthetic Auth accounts; trigger profiles as
  -- technician; only the coordinator profile is elevated here.
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

  -- Draft inspection that owns the capture tests.
  v_op := gen_random_uuid();
  perform public.apply_operation(v_op, v_client, 'inspection.create', v_insp1, null,
    jsonb_build_object('laboratoryId', v_lab, 'inspectionDate', current_date::text, 'summary', 'Captura'));
  -- Second draft for the finalization/followup tests.
  v_op := gen_random_uuid();
  perform public.apply_operation(v_op, v_client, 'inspection.create', v_insp2, null,
    jsonb_build_object('laboratoryId', v_lab, 'inspectionDate', current_date::text, 'summary', 'Seguimiento'));

  -- F1: create a finding on an owned draft; ACK carries the UUID, the parent,
  -- default status and the requested priority, plus a non-null receipt result.
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'finding.create', v_f1, null,
    jsonb_build_object('inspectionId', v_insp1, 'title', 'Hallazgo 1', 'priority', 'high'));
  if (v_result ->> 'id') <> v_f1::text then raise exception 'Create ACK lacks the finding UUID'; end if;
  if (v_result ->> 'inspection_id') <> v_insp1::text then raise exception 'Create ACK lacks the parent'; end if;
  if (v_result ->> 'status') <> 'pending' then raise exception 'New finding is not pending'; end if;
  if (v_result ->> 'priority') <> 'high' then raise exception 'Requested priority was not kept'; end if;
  if v_result ->> 'version' <> '1' then raise exception 'Create did not return version 1'; end if;
  reset role;
  if (select result is null from public.operation_receipts
      where actor_id = v_tec_a and operation_id = v_op) then
    raise exception 'Confirmed receipt left a null result';
  end if;
  set local role authenticated;

  -- F2: replay returns the original ACK and does not advance the version.
  v_prev := v_result;
  v_result := public.apply_operation(v_op, v_client, 'finding.create', v_f1, null,
    jsonb_build_object('inspectionId', v_insp1, 'title', 'Hallazgo 1', 'priority', 'high'));
  if v_result is distinct from v_prev then raise exception 'Replay did not return the original ACK'; end if;
  reset role;
  select version into v_ver from public.findings where id = v_f1;
  if v_ver <> 1 then raise exception 'Replay advanced the finding version'; end if;
  set local role authenticated;

  -- F3: same operation id with different payload -> IDEMPOTENCY_KEY_REUSED.
  v_bad := false;
  begin
    perform public.apply_operation(v_op, v_client, 'finding.create', v_f1, null,
      jsonb_build_object('inspectionId', v_insp1, 'title', 'Cambiado'));
  exception when others then
    if SQLERRM <> 'IDEMPOTENCY_KEY_REUSED' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Idempotency key reused with different payload was accepted'; end if;

  -- F4: update on an owned draft succeeds and bumps the version.
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'finding.update', v_f1, 1,
    jsonb_build_object('title', 'Hallazgo 1 editado', 'description', 'Detalle', 'priority', 'low'));
  if v_result ->> 'version' <> '2' then raise exception 'Update did not bump version to 2'; end if;
  if (v_result ->> 'title') <> 'Hallazgo 1 editado' then raise exception 'Update did not persist the title'; end if;

  -- F5: a second edit with the same baseVersion conflicts safely.
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.update', v_f1, 1,
      jsonb_build_object('title', 'Stale'));
  exception when others then
    if SQLERRM <> 'VERSION_CONFLICT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Stale finding update was accepted'; end if;

  -- F6: the parent FK is immutable; payload cannot move the finding.
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.update', v_f1, 2,
      jsonb_build_object('inspectionId', v_insp2));
  exception when others then
    if SQLERRM <> 'INVALID_INPUT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Finding was moved to another inspection'; end if;

  -- F7: owner/audit fields are not accepted from the payload.
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.create',
      gen_random_uuid(), null, jsonb_build_object('inspectionId', v_insp1, 'created_by', v_tec_a));
  exception when others then
    if SQLERRM <> 'FORBIDDEN_OR_INVALID_INPUT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Audit fields accepted in finding payload'; end if;

  -- F8: a foreign technician cannot create findings on another draft.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_b::text, 'role', 'authenticated')::text, true);
  v_op := gen_random_uuid();
  v_bad := false;
  begin
    perform public.apply_operation(v_op, v_client, 'finding.create', gen_random_uuid(), null,
      jsonb_build_object('inspectionId', v_insp1, 'title', 'Ajeno'));
  exception when others then
    if SQLERRM <> 'NOT_EDITABLE' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Foreign technician created a finding'; end if;
  reset role;
  if exists (select 1 from public.operation_receipts
      where actor_id = v_tec_b and operation_id = v_op) then
    raise exception 'Failed foreign operation left a receipt';
  end if;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_a::text, 'role', 'authenticated')::text, true);

  -- F9: reusing the same entity id with a new operation neither duplicates nor
  -- leaves a receipt.
  v_op := gen_random_uuid();
  v_bad := false;
  begin
    perform public.apply_operation(v_op, v_client, 'finding.create', v_f1, null,
      jsonb_build_object('inspectionId', v_insp1, 'title', 'Duplicado'));
  exception when others then v_bad := true;
  end;
  if not v_bad then raise exception 'Duplicate finding create was accepted'; end if;
  reset role;
  if exists (select 1 from public.operation_receipts
      where actor_id = v_tec_a and operation_id = v_op) then
    raise exception 'Failed duplicate left a receipt';
  end if;
  set local role authenticated;

  -- F10: delete is logical and marks deleted_at.
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'finding.delete', v_f1, 2, '{}'::jsonb);
  if (v_result ->> 'deleted_at') is null then raise exception 'Delete did not set deleted_at'; end if;

  -- F11: a deleted finding is not editable and cannot be recreated.
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.update', v_f1, 3,
      jsonb_build_object('title', 'Resucitar'));
  exception when others then
    if SQLERRM <> 'NOT_FOUND' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Deleted finding was editable'; end if;
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.create', v_f1, null,
      jsonb_build_object('inspectionId', v_insp1, 'title', 'Resucitar'));
  exception when others then v_bad := true;
  end;
  if not v_bad then raise exception 'Deleted finding was recreated'; end if;

  -- F12: a live finding on the draft inspection, for the draft-parent tests.
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'finding.create', v_f6, null,
    jsonb_build_object('inspectionId', v_insp1, 'title', 'Borrador vivo'));
  if v_result ->> 'version' <> '1' then raise exception 'Draft finding create failed'; end if;

  -- Capture findings on the followup inspection.
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'finding.create', v_f2, null,
    jsonb_build_object('inspectionId', v_insp2, 'title', 'Hallazgo 2'));
  if (v_result ->> 'priority') <> 'medium' then raise exception 'Default priority is not medium'; end if;
  v_op := gen_random_uuid();
  perform public.apply_operation(v_op, v_client, 'finding.create', v_f3, null,
    jsonb_build_object('inspectionId', v_insp2, 'title', 'Hallazgo 3'));
  v_op := gen_random_uuid();
  perform public.apply_operation(v_op, v_client, 'finding.create', v_f4, null,
    jsonb_build_object('inspectionId', v_insp2, 'title', 'Hallazgo 4'));
  v_op := gen_random_uuid();
  perform public.apply_operation(v_op, v_client, 'finding.delete', v_f4, 1, '{}'::jsonb);

  -- F16: a finalize whose expected set includes the deleted finding conflicts.
  v_op := gen_random_uuid();
  v_bad := false;
  begin
    perform public.apply_operation(v_op, v_client, 'inspection.finalize', v_insp2, 1,
      jsonb_build_object('expectedFindingIds', jsonb_build_array(v_f2, v_f3, v_f4)));
  exception when others then
    if SQLERRM <> 'FINDING_SET_CONFLICT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Finalize with a stale set was accepted'; end if;
  reset role;
  if exists (select 1 from public.operation_receipts
      where actor_id = v_tec_a and operation_id = v_op) then
    raise exception 'Set conflict left a receipt';
  end if;
  select workflow_status into v_state from public.inspections where id = v_insp2;
  if v_state <> 'draft' then raise exception 'Set conflict changed the state'; end if;
  set local role authenticated;

  -- F17: the exact live set finalizes atomically.
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'inspection.finalize', v_insp2, 1,
    jsonb_build_object('expectedFindingIds', jsonb_build_array(v_f2, v_f3)));
  if (v_result ->> 'workflow_status') <> 'completed' then raise exception 'Finalize did not complete'; end if;

  -- F18: after finalize the capture is immutable for its technician.
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.create', gen_random_uuid(), null,
      jsonb_build_object('inspectionId', v_insp2, 'title', 'Tarde'));
  exception when others then
    if SQLERRM <> 'NOT_EDITABLE' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Finding created after finalize'; end if;
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.update', v_f2, 1,
      jsonb_build_object('title', 'Tarde'));
  exception when others then
    if SQLERRM <> 'NOT_EDITABLE' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Finding edited after finalize'; end if;
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.delete', v_f2, 1, '{}'::jsonb);
  exception when others then
    if SQLERRM <> 'NOT_EDITABLE' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Finding deleted after finalize'; end if;

  -- F19: a technician cannot follow up.
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.followup', v_f2, 1,
      jsonb_build_object('status', 'in_review'));
  exception when others then
    if SQLERRM <> 'FORBIDDEN_OR_INVALID_INPUT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Technician performed followup'; end if;

  -- F20: followup requires a completed parent.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_coord::text, 'role', 'authenticated')::text, true);
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.followup', v_f6, 1,
      jsonb_build_object('status', 'in_review'));
  exception when others then
    if SQLERRM <> 'FORBIDDEN_OR_INVALID_INPUT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Followup on a draft parent was accepted'; end if;

  -- F21: valid transition pending -> in_review.
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'finding.followup', v_f2, 1,
    jsonb_build_object('status', 'in_review'));
  if (v_result ->> 'status') <> 'in_review' then raise exception 'pending->in_review failed'; end if;
  if (v_result ->> 'resolved_at') is not null then raise exception 'in_review set resolved_at'; end if;

  -- F22: valid transition in_review -> resolved sets server resolved_at.
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'finding.followup', v_f2, 2,
    jsonb_build_object('status', 'resolved'));
  if (v_result ->> 'status') <> 'resolved' or (v_result ->> 'resolved_at') is null then
    raise exception 'in_review->resolved did not set resolved_at';
  end if;
  reset role;
  select resolved_at into v_ts from public.findings where id = v_f2;
  set local role authenticated;

  -- F23: reapertura (resolved -> in_review) is rejected without receipt.
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.followup', v_f2, 3,
      jsonb_build_object('status', 'in_review'));
  exception when others then
    if SQLERRM <> 'INVALID_TRANSITION' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Resolved finding was reopened'; end if;

  -- F24: a skipped transition (pending -> resolved) is rejected.
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.followup', v_f3, 1,
      jsonb_build_object('status', 'resolved'));
  exception when others then
    if SQLERRM <> 'INVALID_TRANSITION' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Skipped transition was accepted'; end if;

  -- F25: changing only the priority does not rewrite resolved_at.
  v_op := gen_random_uuid();
  v_result := public.apply_operation(v_op, v_client, 'finding.followup', v_f2, 3,
    jsonb_build_object('priority', 'low'));
  if (v_result ->> 'priority') <> 'low' then raise exception 'Priority followup failed'; end if;
  reset role;
  if (select resolved_at is distinct from v_ts from public.findings where id = v_f2) then
    raise exception 'Priority-only followup rewrote resolved_at';
  end if;
  set local role authenticated;

  -- F26: followup cannot change capture fields.
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.followup', v_f2, 4,
      jsonb_build_object('title', 'Nuevo título'));
  exception when others then
    if SQLERRM <> 'FORBIDDEN_OR_INVALID_INPUT' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Followup changed a capture field'; end if;

  -- Back to the technician: finalize still validates finding titles.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_a::text, 'role', 'authenticated')::text, true);
  v_op := gen_random_uuid();
  perform public.apply_operation(v_op, v_client, 'inspection.create', v_insp3, null,
    jsonb_build_object('laboratoryId', v_lab, 'inspectionDate', current_date::text, 'summary', 'Con título vacío'));
  v_op := gen_random_uuid();
  perform public.apply_operation(v_op, v_client, 'finding.create', v_f5, null,
    jsonb_build_object('inspectionId', v_insp3, 'title', ''));
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.finalize', v_insp3, 1,
      jsonb_build_object('expectedFindingIds', jsonb_build_array(v_f5)));
  exception when others then
    if SQLERRM <> 'FINALIZATION_INVALID' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Empty-titled finding was finalized'; end if;

  -- F28: a discarded parent blocks new findings.
  v_op := gen_random_uuid();
  perform public.apply_operation(v_op, v_client, 'inspection.discard', v_insp1, 1, '{}'::jsonb);
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.create', gen_random_uuid(), null,
      jsonb_build_object('inspectionId', v_insp1, 'title', 'Tarde'));
  exception when others then
    if SQLERRM <> 'NOT_EDITABLE' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Finding created on a discarded parent'; end if;

  -- F29: anon has no EXECUTE and phase 07 read policies are still absent.
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_a::text, 'role', 'anon')::text, true);
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'finding.create',
      gen_random_uuid(), null, jsonb_build_object('inspectionId', v_insp1));
  exception when insufficient_privilege then v_bad := true;
  end;
  if not v_bad then raise exception 'Anon executed apply_operation'; end if;
  reset role;

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
select 'phase-06 finding operations passed' as result;