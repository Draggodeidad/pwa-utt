-- Phase 07 integration checks for read policies and grants. Run in the test
-- project's SQL Editor AFTER applying 20260929030000_read_policies.sql twice
-- (repeatability) on top of phases 04-06. Synthetic Auth accounts and rows are
-- rolled back. Reads exercise RLS directly as each role via request.jwt.claims
-- + set local role; no service-role is used to prove user permissions.
begin;

do $test$
declare
  v_tec_a uuid := gen_random_uuid();
  v_tec_b uuid := gen_random_uuid();
  v_coord uuid := gen_random_uuid();
  v_inact uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_lab uuid := '11111111-1111-4111-8111-111111111111';
  v_insp_a uuid := gen_random_uuid();
  v_insp_ac uuid := gen_random_uuid();
  v_insp_b uuid := gen_random_uuid();
  v_fa1 uuid := gen_random_uuid();
  v_fa2 uuid := gen_random_uuid();
  v_fb1 uuid := gen_random_uuid();
  v_cnt integer;
  v_bad boolean;
begin
  -- Admin setup: four synthetic Auth accounts; profiles start as technician.
  insert into auth.users (id, raw_user_meta_data)
  values (v_tec_a, '{}'::jsonb), (v_tec_b, '{}'::jsonb),
         (v_coord, '{}'::jsonb), (v_inact, '{}'::jsonb);
  if (select count(*) from public.profiles
      where id in (v_tec_a, v_tec_b, v_coord, v_inact) and role = 'technician') <> 4 then
    raise exception 'Synthetic profiles were not created as technician';
  end if;
  update public.profiles set role = 'coordinator' where id = v_coord;
  update public.profiles set active = false where id = v_inact;

  -- Seed a draft and a completed inspection for A, and a draft for B.
  insert into public.inspections (id, client_id, inspector_id, laboratory_id, inspection_date, summary)
  values (v_insp_a, v_client, v_tec_a, v_lab, current_date, 'Borrador A');
  insert into public.inspections (id, client_id, inspector_id, laboratory_id, inspection_date,
    summary, workflow_status, completed_at)
  values (v_insp_ac, v_client, v_tec_a, v_lab, current_date, 'Completada A', 'completed', now());
  insert into public.inspections (id, client_id, inspector_id, laboratory_id, inspection_date, summary)
  values (v_insp_b, v_client, v_tec_b, v_lab, current_date, 'Borrador B');
  insert into public.findings (id, client_id, inspection_id, title, created_by, updated_by)
  values (v_fa1, v_client, v_insp_a, 'Hallazgo A borrador', v_tec_a, v_tec_a);
  insert into public.findings (id, client_id, inspection_id, title, created_by, updated_by)
  values (v_fa2, v_client, v_insp_ac, 'Hallazgo A completada', v_tec_a, v_tec_a);
  insert into public.findings (id, client_id, inspection_id, title, created_by, updated_by)
  values (v_fb1, v_client, v_insp_b, 'Hallazgo B borrador', v_tec_b, v_tec_b);

  -- The RPC is the only write path: create one draft per technician so each
  -- owns a receipt to test receipt isolation.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_a::text, 'role', 'authenticated')::text, true);
  perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.create',
    gen_random_uuid(), null, jsonb_build_object('laboratoryId', v_lab, 'summary', 'RPC A'));
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_b::text, 'role', 'authenticated')::text, true);
  perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.create',
    gen_random_uuid(), null, jsonb_build_object('laboratoryId', v_lab, 'summary', 'RPC B'));

  -- Technician A: own drafts + completed, own findings, own receipts only.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_a::text, 'role', 'authenticated')::text, true);
  select count(*) into v_cnt from public.inspections;
  if v_cnt <> 3 then raise exception 'A sees % inspections (expected 3)', v_cnt; end if;
  select count(*) into v_cnt from public.findings;
  if v_cnt <> 2 then raise exception 'A sees % findings (expected 2)', v_cnt; end if;
  select count(*) into v_cnt from public.laboratories;
  if v_cnt <> 3 then raise exception 'A sees % laboratories (expected 3)', v_cnt; end if;
  select count(*) into v_cnt from public.profiles;
  if v_cnt <> 1 then raise exception 'A sees % profiles (expected 1)', v_cnt; end if;
  select count(*) into v_cnt from public.operation_receipts;
  if v_cnt <> 1 then raise exception 'A sees % receipts (expected 1)', v_cnt; end if;
  if exists (select 1 from public.inspections where id = v_insp_b)
    or exists (select 1 from public.findings where id = v_fb1) then
    raise exception 'A reached B data';
  end if;
  if exists (select 1 from public.operation_receipts where actor_id = v_tec_b) then
    raise exception 'A reached B receipts';
  end if;

  -- Technician B: only its own draft and finding; no receipt from A.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_b::text, 'role', 'authenticated')::text, true);
  select count(*) into v_cnt from public.inspections;
  if v_cnt <> 2 then raise exception 'B sees % inspections (expected 2)', v_cnt; end if;
  select count(*) into v_cnt from public.findings;
  if v_cnt <> 1 then raise exception 'B sees % findings (expected 1)', v_cnt; end if;
  select count(*) into v_cnt from public.profiles;
  if v_cnt <> 1 then raise exception 'B sees % profiles (expected 1)', v_cnt; end if;
  select count(*) into v_cnt from public.operation_receipts;
  if v_cnt <> 1 then raise exception 'B sees % receipts (expected 1)', v_cnt; end if;
  if exists (select 1 from public.inspections where id in (v_insp_a, v_insp_ac))
    or exists (select 1 from public.findings where id in (v_fa1, v_fa2)) then
    raise exception 'B reached A data';
  end if;
  if exists (select 1 from public.operation_receipts where actor_id = v_tec_a) then
    raise exception 'B reached A receipts';
  end if;

  -- Coordinator: only completed inspections and their findings; all profiles.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_coord::text, 'role', 'authenticated')::text, true);
  select count(*) into v_cnt from public.inspections;
  if v_cnt <> 1 then raise exception 'Coordinator sees % inspections (expected 1)', v_cnt; end if;
  select count(*) into v_cnt from public.findings;
  if v_cnt <> 1 then raise exception 'Coordinator sees % findings (expected 1)', v_cnt; end if;
  select count(*) into v_cnt from public.profiles;
  if v_cnt <> 4 then raise exception 'Coordinator sees % profiles (expected 4)', v_cnt; end if;
  select count(*) into v_cnt from public.operation_receipts;
  if v_cnt <> 0 then raise exception 'Coordinator sees % receipts (expected 0)', v_cnt; end if;
  if exists (select 1 from public.inspections where id in (v_insp_a, v_insp_b))
    or exists (select 1 from public.findings where id in (v_fa1, v_fb1)) then
    raise exception 'Coordinator reached drafts';
  end if;

  -- Inactive profile: no reads and no RPC.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_inact::text, 'role', 'authenticated')::text, true);
  select count(*) into v_cnt from public.inspections;
  if v_cnt <> 0 then raise exception 'Inactive user reads % inspections', v_cnt; end if;
  select count(*) into v_cnt from public.laboratories;
  if v_cnt <> 0 then raise exception 'Inactive user reads % laboratories', v_cnt; end if;
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.create',
      gen_random_uuid(), null, '{}'::jsonb);
  exception when others then
    if SQLERRM <> 'FORBIDDEN' then raise; end if;
    v_bad := true;
  end;
  if not v_bad then raise exception 'Inactive user executed apply_operation'; end if;

  -- Anonymous: no table reads, no RPC, no helpers.
  reset role;
  set local role anon;
  v_bad := false;
  begin
    perform (select count(*) from public.inspections);
  exception when insufficient_privilege then v_bad := true;
  end;
  if not v_bad then raise exception 'Anon read inspections'; end if;
  v_bad := false;
  begin
    perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.create',
      gen_random_uuid(), null, '{}'::jsonb);
  exception when insufficient_privilege then v_bad := true;
  end;
  if not v_bad then raise exception 'Anon executed apply_operation'; end if;
  reset role;

  -- Direct writes are denied even to an active technician.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_tec_a::text, 'role', 'authenticated')::text, true);
  v_bad := false;
  begin
    insert into public.inspections (id, client_id, inspector_id)
    values (gen_random_uuid(), v_client, v_tec_a);
  exception when insufficient_privilege then v_bad := true;
  end;
  if not v_bad then raise exception 'Direct inspection INSERT allowed'; end if;
  v_bad := false;
  begin
    update public.inspections set summary = 'x' where id = v_insp_a;
  exception when insufficient_privilege then v_bad := true;
  end;
  if not v_bad then raise exception 'Direct inspection UPDATE allowed'; end if;
  v_bad := false;
  begin
    delete from public.findings where id = v_fa1;
  exception when insufficient_privilege then v_bad := true;
  end;
  if not v_bad then raise exception 'Direct finding DELETE allowed'; end if;
  v_bad := false;
  begin
    update public.profiles set role = 'coordinator' where id = v_tec_a;
  exception when insufficient_privilege then v_bad := true;
  end;
  if not v_bad then raise exception 'Self role elevation allowed'; end if;
  v_bad := false;
  begin
    insert into public.laboratories (code, name) values ('X', 'X');
  exception when insufficient_privilege then v_bad := true;
  end;
  if not v_bad then raise exception 'Direct laboratory INSERT allowed'; end if;
  v_bad := false;
  begin
    insert into public.operation_receipts
      (actor_id, operation_id, client_id, operation_type, entity_type,
       entity_id, request_hash, request_payload)
    values (v_tec_a, gen_random_uuid(), v_client, 'inspection.create',
      'inspection', gen_random_uuid(), 'x', '{}'::jsonb);
  exception when insufficient_privilege then v_bad := true;
  end;
  if not v_bad then raise exception 'Direct receipt INSERT allowed'; end if;

  -- The validated RPC remains the only working write path after the policies.
  perform public.apply_operation(gen_random_uuid(), v_client, 'inspection.create',
    gen_random_uuid(), null, jsonb_build_object('laboratoryId', v_lab, 'summary', 'RPC post-políticas'));

  -- Grants and helper visibility.
  if has_function_privilege('anon', 'public.is_active_user()', 'EXECUTE')
    or has_function_privilege('anon', 'public.is_coordinator()', 'EXECUTE')
    or has_function_privilege('anon', 'public.is_technician()', 'EXECUTE') then
    raise exception 'Anon can execute a role helper';
  end if;
  if not has_function_privilege('authenticated', 'public.is_active_user()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.is_coordinator()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.is_technician()', 'EXECUTE') then
    raise exception 'Authenticated cannot execute a role helper';
  end if;
  if has_table_privilege('authenticated', 'public.inspections', 'INSERT')
    or has_table_privilege('authenticated', 'public.inspections', 'UPDATE')
    or has_table_privilege('authenticated', 'public.inspections', 'DELETE')
    or has_table_privilege('anon', 'public.inspections', 'SELECT') then
    raise exception 'Unexpected write privilege for an app role';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in
    ('profiles', 'laboratories', 'inspections', 'findings', 'operation_receipts') and permissive = 'RESTRICTIVE') then
    raise exception 'Restrictive policies were expected permissive';
  end if;
end $test$;

rollback;
select 'phase-07 permissions passed' as result;