-- Disposable local DB only. Create actual legacy rows BEFORE the new migration.
insert into auth.users(id) values('11111111-1111-4111-8111-111111111195');
insert into public.laboratories(id,code,name) values('22222222-2222-4222-8222-222222222295','UPGRADE','Synthetic legacy lab');
insert into public.inspections(id,client_id,inspector_id,laboratory_id,inspection_date,summary,workflow_status,completed_at)
values('33333333-3333-4333-8333-333333333395',gen_random_uuid(),'11111111-1111-4111-8111-111111111195','22222222-2222-4222-8222-222222222295','2026-09-01','Legacy observations','completed','2026-09-01T12:00:00Z');
insert into public.findings(id,client_id,inspection_id,title,created_by,updated_by)
values('44444444-4444-4444-8444-444444444495',gen_random_uuid(),'33333333-3333-4333-8333-333333333395','Legacy finding','11111111-1111-4111-8111-111111111195','11111111-1111-4111-8111-111111111195');
insert into public.finding_photos(id,finding_id,inspection_id,owner_user_id,object_path,mime_type,bytes,source_hash,content_hash,state)
values('55555555-5555-4555-8555-555555555595','44444444-4444-4444-8444-444444444495','33333333-3333-4333-8333-333333333395','11111111-1111-4111-8111-111111111195','synthetic-legacy-object','image/png',12,repeat('a',64),repeat('b',64),'uploaded');
insert into storage.objects(bucket_id,name,metadata) values('finding-photos','synthetic-legacy-object','{}');
\ir ../migrations/20261010010000_coordination_lifecycle.sql
-- Repeat against populated tables, not just an empty schema.
\ir ../migrations/20261010010000_coordination_lifecycle.sql
do $$ begin
  if not exists(select 1 from public.inspections where id='33333333-3333-4333-8333-333333333395'
    and review_status='pending' and review_notes='' and archived_at is null and deleted_at is null
    and reviewed_by is null and reviewed_at is null and version=1 and summary='Legacy observations'
    and workflow_status='completed' and completed_at='2026-09-01T12:00:00Z') then raise exception 'UPGRADE: legacy inspection changed'; end if;
  if not exists(select 1 from public.finding_photos where id='55555555-5555-4555-8555-555555555595' and state='uploaded' and version=1)
    or not exists(select 1 from storage.objects where name='synthetic-legacy-object') then raise exception 'UPGRADE: legacy photo changed'; end if;
end $$;
-- Keep subsequent rollback suites isolated from this upgrade fixture.
delete from storage.objects where name='synthetic-legacy-object';
delete from public.finding_photos where id='55555555-5555-4555-8555-555555555595';
delete from public.findings where id='44444444-4444-4444-8444-444444444495';
delete from public.inspections where id='33333333-3333-4333-8333-333333333395';
delete from public.laboratories where id='22222222-2222-4222-8222-222222222295';
delete from public.profiles where id='11111111-1111-4111-8111-111111111195';
delete from auth.users where id='11111111-1111-4111-8111-111111111195';
