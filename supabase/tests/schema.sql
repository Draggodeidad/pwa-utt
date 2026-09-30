-- Phase 04 integration checks. Run in the test project's SQL Editor after
-- migration and seed. All synthetic rows in this file are rolled back.
begin;

do $test$
declare
  v_table text;
  v_actor uuid := gen_random_uuid();
  v_inspection uuid := gen_random_uuid();
  v_completed uuid := gen_random_uuid();
  v_finding uuid := gen_random_uuid();
  v_rejected boolean;
begin
  if current_setting('server_version_num')::integer < 130000 then
    raise exception 'PostgreSQL 13 or newer is required';
  end if;

  if (select count(*) from information_schema.tables
      where table_schema = 'public' and table_name in
        ('profiles', 'laboratories', 'inspections', 'findings', 'operation_receipts')) <> 5 then
    raise exception 'Expected five application tables';
  end if;
  if (select count(*) from public.laboratories where code in ('LAB-A', 'LAB-B', 'LAB-C')) <> 3
    or (select count(*) from public.laboratories) <> 3 then
    raise exception 'Expected exactly three synthetic laboratories';
  end if;
  if exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inspections'
      and column_name in ('result', 'finding_count', 'sync_status')) then
    raise exception 'Derived or local-only inspection column persisted';
  end if;
  if (select count(*) from information_schema.columns where table_schema = 'public'
    and data_type = 'uuid' and (table_name, column_name) in
      (('profiles','id'), ('laboratories','id'),
       ('inspections','id'), ('inspections','client_id'), ('inspections','laboratory_id'),
       ('inspections','inspector_id'), ('inspections','updated_by'),
       ('findings','id'), ('findings','client_id'), ('findings','inspection_id'),
       ('findings','created_by'), ('findings','updated_by'),
       ('operation_receipts','actor_id'), ('operation_receipts','operation_id'),
       ('operation_receipts','client_id'), ('operation_receipts','entity_id'))) <> 16 then
    raise exception 'An entity, actor, or operation identifier is not UUID';
  end if;

  foreach v_table in array array['profiles', 'laboratories', 'inspections',
    'findings', 'operation_receipts'] loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table and c.relrowsecurity) then
      raise exception 'RLS missing on %', v_table;
    end if;
    if has_table_privilege('anon', 'public.' || v_table, 'SELECT')
      or has_table_privilege('authenticated', 'public.' || v_table, 'SELECT')
      or has_table_privilege('authenticated', 'public.' || v_table, 'INSERT')
      or has_table_privilege('authenticated', 'public.' || v_table, 'UPDATE')
      or has_table_privilege('authenticated', 'public.' || v_table, 'DELETE') then
      raise exception 'App role has premature access to %', v_table;
    end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in
    ('profiles', 'laboratories', 'inspections', 'findings', 'operation_receipts')) then
    raise exception 'Read policies belong to phase 07';
  end if;
  if has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') then
    raise exception 'Signup trigger function is callable by authenticated';
  end if;
  if has_sequence_privilege('anon', pg_get_serial_sequence('public.inspections','folio_number'), 'USAGE')
    or has_sequence_privilege('authenticated', pg_get_serial_sequence('public.inspections','folio_number'), 'USAGE') then
    raise exception 'App role can advance the server folio sequence';
  end if;

  -- Auth metadata must never elevate a profile. This row is transaction-local.
  insert into auth.users (id, raw_user_meta_data)
    values (v_actor, '{"role":"coordinator","display_name":"Cuenta sintética"}'::jsonb);
  if (select role from public.profiles where id = v_actor) <> 'technician' then
    raise exception 'Signup metadata elevated the profile';
  end if;

  insert into public.inspections (id, client_id, inspector_id, updated_by)
    values (v_inspection, gen_random_uuid(), v_actor, v_actor);
  update public.inspections set version = 999 where id = v_inspection;
  if (select version from public.inspections where id = v_inspection) <> 2 then
    raise exception 'Inspection version is not server controlled';
  end if;

  v_rejected := false;
  begin
    insert into public.inspections (id, client_id, inspector_id, workflow_status)
      values (gen_random_uuid(), gen_random_uuid(), v_actor, 'completed');
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Completed inspection without timestamp accepted'; end if;

  v_rejected := false;
  begin
    insert into public.inspections (id, client_id, inspector_id, workflow_status, completed_at)
      values (gen_random_uuid(), gen_random_uuid(), v_actor, 'completed', now());
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Incomplete finalization accepted'; end if;

  insert into public.inspections
    (id, client_id, inspector_id, laboratory_id, inspection_date, summary,
     workflow_status, completed_at)
    values (v_completed, gen_random_uuid(), v_actor,
      '11111111-1111-4111-8111-111111111111', current_date, 'Resumen sintético',
      'completed', now());

  v_rejected := false;
  begin
    insert into public.inspections (id, client_id, inspector_id, version)
      values (gen_random_uuid(), gen_random_uuid(), v_actor, 0);
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Nonpositive inspection version accepted'; end if;

  v_rejected := false;
  begin
    insert into public.inspections (id, client_id, inspector_id, laboratory_id)
      values (gen_random_uuid(), gen_random_uuid(), v_actor, gen_random_uuid());
  exception when foreign_key_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Unknown laboratory FK accepted'; end if;

  insert into public.findings (id, client_id, inspection_id, created_by, updated_by)
    values (v_finding, gen_random_uuid(), v_inspection, v_actor, v_actor);
  update public.findings set version = 999 where id = v_finding;
  if (select version from public.findings where id = v_finding) <> 2 then
    raise exception 'Finding version is not server controlled';
  end if;

  v_rejected := false;
  begin
    insert into public.findings
      (id, client_id, inspection_id, created_by, updated_by, version)
      values (gen_random_uuid(), gen_random_uuid(), v_inspection, v_actor, v_actor, 0);
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Nonpositive finding version accepted'; end if;

  v_rejected := false;
  begin
    insert into public.findings
      (id, client_id, inspection_id, created_by, updated_by, status)
      values (gen_random_uuid(), gen_random_uuid(), v_inspection, v_actor, v_actor, 'resolved');
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Resolved finding without timestamp accepted'; end if;

  v_rejected := false;
  begin
    insert into public.findings
      (id, client_id, inspection_id, created_by, updated_by, resolved_at)
      values (gen_random_uuid(), gen_random_uuid(), v_inspection, v_actor, v_actor, now());
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Pending finding with resolved_at accepted'; end if;

  insert into public.findings
    (id, client_id, inspection_id, created_by, updated_by, status, resolved_at)
    values (gen_random_uuid(), gen_random_uuid(), v_completed, v_actor, v_actor,
      'resolved', now());

  v_rejected := false;
  begin
    insert into public.findings
      (id, client_id, inspection_id, created_by, updated_by)
      values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), v_actor, v_actor);
  exception when foreign_key_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Unknown inspection FK accepted'; end if;

  v_rejected := false;
  begin
    insert into public.operation_receipts
      (actor_id, operation_id, client_id, operation_type, entity_type,
       entity_id, request_hash, request_payload)
      values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
        'inspection.create', 'inspection', v_inspection, 'test', '{}'::jsonb);
  exception when foreign_key_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Unknown receipt actor FK accepted'; end if;
end $test$;

-- Exercise ordinary application privileges, not only catalog introspection.
set local role authenticated;
do $test$
declare
  v_rejected boolean;
begin
  v_rejected := false;
  begin
    update public.profiles set role = 'coordinator' where id = gen_random_uuid();
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Authenticated role can update profiles'; end if;

  v_rejected := false;
  begin
    insert into public.laboratories (code, name) values ('UNAUTHORIZED', 'Unauthorized');
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Authenticated role can write domain tables'; end if;
end $test$;
reset role;

rollback;
select 'phase-04 schema checks passed' as result;
