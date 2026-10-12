-- Disposable local PostgreSQL with photo-local-bootstrap.sql; synthetic GPS only.
begin;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111170'),('22222222-2222-4222-8222-222222222270'),
 ('33333333-3333-4333-8333-333333333370');
update public.profiles set role = 'coordinator' where id = '33333333-3333-4333-8333-333333333370';
insert into public.laboratories(id,code,name) values('55555555-5555-4555-8555-555555555570','GPS-TEST','Synthetic GPS');
insert into public.inspections(id,client_id,inspector_id,laboratory_id,inspection_date,summary)
select ('66666666-6666-4666-8666-66666666667' || n)::uuid,
 '77777777-7777-4777-8777-777777777770','11111111-1111-4111-8111-111111111170',
 '55555555-5555-4555-8555-555555555570',current_date,'Synthetic' from generate_series(0,3) n;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111170"}',true);
do $$ declare ack jsonb; payload jsonb := '{"expectedFindingIds":[],"location":{"latitude":19.4326,"longitude":-99.1332,"accuracy":12.5,"capturedAt":"2026-10-09T12:00:00.000Z"}}'; begin
  ack := public.apply_operation('99999999-9999-4999-8999-999999999970','77777777-7777-4777-8777-777777777770','inspection.finalize','66666666-6666-4666-8666-666666666670',1,payload);
  if ack ? 'location' or ack ? 'latitude' then raise exception 'GPS leaked in RPC result'; end if;
  ack := public.apply_operation('99999999-9999-4999-8999-999999999970','77777777-7777-4777-8777-777777777770','inspection.finalize','66666666-6666-4666-8666-666666666670',1,payload);
  if ack ->> '__replayed' <> 'true' or (ack ->> 'version')::integer <> 2 then raise exception 'Replay changed finalization'; end if;
  if exists(select 1 from public.inspection_locations) then raise exception 'Technician reads own GPS'; end if;
  begin perform request_payload from public.operation_receipts; raise exception 'Request GPS leaked'; exception when insufficient_privilege then null; end;
  begin insert into public.inspection_locations(inspection_id) values('66666666-6666-4666-8666-666666666673'); raise exception 'Direct GPS write permitted'; exception when insufficient_privilege then null; end;
  begin perform public.apply_operation(gen_random_uuid(),'77777777-7777-4777-8777-777777777770','inspection.finalize','66666666-6666-4666-8666-666666666673',1,'{"expectedFindingIds":[],"location":{"latitude":91,"longitude":0,"accuracy":1,"capturedAt":"2026-10-09T12:00:00Z"}}'); raise exception 'Invalid latitude accepted'; exception when raise_exception then if sqlerrm <> 'INVALID_INPUT' then raise; end if; end;
  begin perform public.apply_operation(gen_random_uuid(),'77777777-7777-4777-8777-777777777770','inspection.finalize','66666666-6666-4666-8666-666666666673',1,'{"expectedFindingIds":["88888888-8888-4888-8888-888888888870"],"location":{"latitude":0,"longitude":0,"accuracy":1,"capturedAt":"2026-10-09T12:00:00Z"}}'); raise exception 'Wrong set accepted'; exception when raise_exception then if sqlerrm <> 'FINDING_SET_CONFLICT' then raise; end if; end;
end $$;
select public.apply_operation(gen_random_uuid(),'77777777-7777-4777-8777-777777777770','inspection.finalize','66666666-6666-4666-8666-666666666671',1,'{"expectedFindingIds":[],"location":null}');
select public.apply_operation(gen_random_uuid(),'77777777-7777-4777-8777-777777777770','inspection.finalize','66666666-6666-4666-8666-666666666672',1,'{"expectedFindingIds":[]}');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222270"}',true);
do $$ begin if exists(select 1 from public.inspection_locations) then raise exception 'Other technician reads GPS'; end if; end $$;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333370"}',true);
do $$ begin
  if (select count(*) from public.inspection_locations) <> 3 then raise exception 'Coordinator missing finalized snapshots'; end if;
  if not exists(select 1 from public.inspection_locations where latitude = 19.4326 and longitude = -99.1332 and accuracy = 12.5 and captured_at = '2026-10-09T12:00:00Z') then raise exception 'Snapshot persistence failed'; end if;
  if (select count(*) from public.inspection_locations where latitude is null and longitude is null and accuracy is null and captured_at is null) <> 2 then raise exception 'Missing/null GPS not stored as null'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.inspection_locations where inspection_id = '66666666-6666-4666-8666-666666666673') then raise exception 'Failed finalization persisted GPS'; end if;
  if not exists(select 1 from public.inspections where id = '66666666-6666-4666-8666-666666666673' and workflow_status = 'draft' and version = 1) then raise exception 'Failure changed inspection'; end if;
end $$;
update public.profiles set active = false where id = '33333333-3333-4333-8333-333333333370';
set local role authenticated;
do $$ begin if exists(select 1 from public.inspection_locations) then raise exception 'Inactive coordinator reads GPS'; end if; end $$;
reset role;
set local role anon;
do $$ begin begin perform latitude from public.inspection_locations; raise exception 'Anonymous reads GPS'; exception when insufficient_privilege then null; end; end $$;
reset role;
rollback;
