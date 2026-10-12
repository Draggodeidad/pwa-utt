-- Disposable local PostgreSQL + simulated Auth/Storage, never a remote project.
-- Real SQL/RLS/constraints/RPC assertions; all synthetic rows are rolled back.
begin;
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'COORDINATION TEST: %',message; end if; end $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement; exception when others then
    if sqlerrm = expected then return; end if;
    raise exception 'COORDINATION TEST: expected %, got %', expected,sqlerrm;
  end;
  raise exception 'COORDINATION TEST: expected error %',expected;
end $$;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111180'), -- tech
 ('22222222-2222-4222-8222-222222222280'), -- coordinator
 ('33333333-3333-4333-8333-333333333380'), -- inactive coordinator
 ('44444444-4444-4444-8444-444444444480'); -- other tech
update public.profiles set role='coordinator' where id in ('22222222-2222-4222-8222-222222222280','33333333-3333-4333-8333-333333333380');
update public.profiles set active=false where id='33333333-3333-4333-8333-333333333380';
insert into public.laboratories(id,code,name) values('55555555-5555-4555-8555-555555555580','COORD-TEST','Synthetic coordination');
insert into public.inspections(id,client_id,inspector_id,laboratory_id,inspection_date,summary,workflow_status,completed_at) values
 ('66666666-6666-4666-8666-666666666680',gen_random_uuid(),'11111111-1111-4111-8111-111111111180','55555555-5555-4555-8555-555555555580',current_date,'Original technician observations','completed',now()),
 ('66666666-6666-4666-8666-666666666681',gen_random_uuid(),'11111111-1111-4111-8111-111111111180','55555555-5555-4555-8555-555555555580',current_date,'Rejected path','completed',now()),
 ('66666666-6666-4666-8666-666666666682',gen_random_uuid(),'22222222-2222-4222-8222-222222222280',null,null,'Former technician draft','draft',null);
insert into public.findings(id,client_id,inspection_id,title,created_by,updated_by) values
 ('77777777-7777-4777-8777-777777777780',gen_random_uuid(),'66666666-6666-4666-8666-666666666680','Synthetic finding','11111111-1111-4111-8111-111111111180','11111111-1111-4111-8111-111111111180');
insert into public.finding_photos(id,finding_id,inspection_id,owner_user_id,object_path,mime_type,bytes,source_hash,content_hash,state) values
 ('88888888-8888-4888-8888-888888888880','77777777-7777-4777-8777-777777777780','66666666-6666-4666-8666-666666666680','11111111-1111-4111-8111-111111111180','coord-test-object','image/png',12,repeat('a',64),repeat('b',64),'uploaded');
insert into storage.objects(bucket_id,name,metadata) values('finding-photos','coord-test-object','{}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222280"}',true);
select pg_temp.assert_true((select review_status='pending' and archived_at is null from public.inspections where id='66666666-6666-4666-8666-666666666680'),'safe legacy defaults');
select pg_temp.assert_true(not exists(select 1 from public.inspections where id='66666666-6666-4666-8666-666666666682'),'coordinator cannot read own old draft');
select pg_temp.assert_true(exists(select 1 from public.finding_photos where id='88888888-8888-4888-8888-888888888880'),'authorized evidence visible');
select pg_temp.assert_true(exists(select 1 from storage.objects where name='coord-test-object'),'private object visible to coordinator');
select pg_temp.expect_error($q$select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666682',1,'approve')$q$,'NOT_FOUND');
select pg_temp.expect_error($q$select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666680',1,'reject','   ')$q$,'INVALID_INPUT');
select pg_temp.expect_error($q$select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666680',1,'archive')$q$,'VERSION_OR_STATE_CONFLICT');
select pg_temp.expect_error($q$select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666680',1,'unarchive')$q$,'VERSION_OR_STATE_CONFLICT');
select public.coordinate_inspection('99999999-9999-4999-8999-999999999980','66666666-6666-4666-8666-666666666680',1,'approve','Coordinator note');
select pg_temp.assert_true((public.coordinate_inspection('99999999-9999-4999-8999-999999999980','66666666-6666-4666-8666-666666666680',1,'approve','Coordinator note')->>'replayed')::boolean,'lost response replay');
select pg_temp.expect_error($q$select public.coordinate_inspection('99999999-9999-4999-8999-999999999980','66666666-6666-4666-8666-666666666680',1,'reject','Different')$q$,'IDEMPOTENCY_KEY_REUSED');
select pg_temp.assert_true((select version=2 and review_status='approved' and reviewed_by=auth.uid() and reviewed_at is not null and review_notes='Coordinator note' and summary='Original technician observations' and workflow_status='completed' from public.inspections where id='66666666-6666-4666-8666-666666666680'),'decision audited, technical data unchanged');
select pg_temp.expect_error($q$select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666680',1,'archive')$q$,'VERSION_CONFLICT');
select pg_temp.expect_error($q$select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666680',2,'reject','Correction')$q$,'VERSION_OR_STATE_CONFLICT');
-- Strong confirmation comes from the actual assigned folio.
select pg_temp.expect_error(format('select public.coordinate_inspection(gen_random_uuid(),%L,2,''delete'','''',%L)','66666666-6666-4666-8666-666666666680',(select 'INS-'||folio_number from public.inspections where id='66666666-6666-4666-8666-666666666680')),'VERSION_OR_STATE_CONFLICT');
select public.coordinate_inspection('99999999-9999-4999-8999-999999999981','66666666-6666-4666-8666-666666666680',2,'archive');
select pg_temp.assert_true((select version=3 and archived_at is not null and archived_by=auth.uid() from public.inspections where id='66666666-6666-4666-8666-666666666680'),'archive audited');
select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666680',3,'archive');
select pg_temp.assert_true((select version=3 from public.inspections where id='66666666-6666-4666-8666-666666666680'),'repeated archive no version/event duplication');
select pg_temp.expect_error($q$select public.apply_operation(gen_random_uuid(),gen_random_uuid(),'finding.followup','77777777-7777-4777-8777-777777777780',1,'{"status":"in_review"}')$q$,'VERSION_OR_STATE_CONFLICT');
select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666680',3,'unarchive');
select pg_temp.assert_true((select version=4 and archived_at is null and review_status='approved' from public.inspections where id='66666666-6666-4666-8666-666666666680'),'unarchive keeps decision');
select pg_temp.assert_true((select status='pending' and version=1 from public.findings where id='77777777-7777-4777-8777-777777777780'),'finding state unchanged');
select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666680',4,'archive');
select pg_temp.expect_error($q$select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666680',5,'delete','','WRONG')$q$,'INVALID_CONFIRMATION');
select set_config('test.deleted_folio','INS-'||folio_number,true) from public.inspections where id='66666666-6666-4666-8666-666666666680';
select public.coordinate_inspection('99999999-9999-4999-8999-999999999982','66666666-6666-4666-8666-666666666680',5,'delete','', 'INS-'||folio_number) from public.inspections where id='66666666-6666-4666-8666-666666666680';
select pg_temp.assert_true(not exists(select 1 from public.inspections where id='66666666-6666-4666-8666-666666666680'),'deleted hidden by RLS');
select pg_temp.assert_true(not exists(select 1 from public.findings where id='77777777-7777-4777-8777-777777777780'),'deleted parent hides findings');
select pg_temp.assert_true(not exists(select 1 from public.finding_photos where id='88888888-8888-4888-8888-888888888880'),'deleted parent hides photo metadata');
select pg_temp.assert_true(not exists(select 1 from storage.objects where name='coord-test-object'),'deleted parent hides private object');
select pg_temp.expect_error($q$select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666680',6,'unarchive')$q$,'NOT_FOUND');
select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666681',1,'reject','Reason');
select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666681',2,'delete','','INS-'||folio_number) from public.inspections where id='66666666-6666-4666-8666-666666666681';
-- SQL DML remains denied even to coordination.
select pg_temp.expect_error($q$update public.inspections set review_status='approved'$q$,'permission denied for table inspections');
select pg_temp.expect_error($q$delete from public.inspections$q$,'permission denied for table inspections');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111180"}',true);
select pg_temp.expect_error($q$select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666680',6,'approve')$q$,'FORBIDDEN');
select pg_temp.assert_true(not exists(select 1 from public.inspections where id='66666666-6666-4666-8666-666666666680'),'technician cannot see deleted');
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333380"}',true);
select pg_temp.expect_error($q$select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666680',6,'approve')$q$,'FORBIDDEN');
select pg_temp.assert_true(not exists(select 1 from public.inspections),'inactive cannot read');
select set_config('request.jwt.claims','{}',true);
select pg_temp.expect_error($q$select public.coordinate_inspection(gen_random_uuid(),'66666666-6666-4666-8666-666666666680',6,'approve')$q$,'UNAUTHENTICATED');
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.coordinate_inspection(uuid,uuid,integer,text,text,text)','EXECUTE'),'anon cannot execute');
select pg_temp.assert_true((select deleted_at is not null and deleted_by='22222222-2222-4222-8222-222222222280' and version=6 from public.inspections where id='66666666-6666-4666-8666-666666666680'),'soft-deleted inspection remains');
select pg_temp.assert_true(exists(select 1 from public.findings where id='77777777-7777-4777-8777-777777777780'),'finding physically retained');
select pg_temp.assert_true(exists(select 1 from public.finding_photos where id='88888888-8888-4888-8888-888888888880' and state='uploaded'),'photo metadata retained');
select pg_temp.assert_true(exists(select 1 from storage.objects where name='coord-test-object'),'object physically retained');
-- ACK remains available after deletion only for the original actor/request.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222280"}',true);
select pg_temp.assert_true((public.coordinate_inspection('99999999-9999-4999-8999-999999999982','66666666-6666-4666-8666-666666666680',5,'delete','',current_setting('test.deleted_folio'))->>'replayed')::boolean,'delete replay after hidden');
reset role;
rollback;
