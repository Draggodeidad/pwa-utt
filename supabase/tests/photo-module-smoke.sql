-- Own #69 SQL smoke checks. Run only in a disposable local DB with simulated Storage; always rolls back.
-- Tests DB/RLS with synthetic identities, not the Storage HTTP service or camera.
begin;
insert into auth.users(id, raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111169','{}'),
 ('22222222-2222-4222-8222-222222222269','{}'),
 ('33333333-3333-4333-8333-333333333369','{}'),
 ('44444444-4444-4444-8444-444444444469','{}');
update public.profiles set role = 'coordinator' where id = '33333333-3333-4333-8333-333333333369';
update public.profiles set active = false where id = '44444444-4444-4444-8444-444444444469';
insert into public.laboratories(id,code,name) values('55555555-5555-4555-8555-555555555569','PHOTO-SMOKE','Synthetic photo smoke');
insert into public.inspections(id,client_id,inspector_id,laboratory_id,inspection_date,summary) values
 ('66666666-6666-4666-8666-666666666669','77777777-7777-4777-8777-777777777769','11111111-1111-4111-8111-111111111169','55555555-5555-4555-8555-555555555569',current_date,'Synthetic');
insert into public.findings(id,client_id,inspection_id,title,created_by,updated_by) values
 ('88888888-8888-4888-8888-888888888869','77777777-7777-4777-8777-777777777769','66666666-6666-4666-8666-666666666669','Synthetic','11111111-1111-4111-8111-111111111169','11111111-1111-4111-8111-111111111169');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111169","role":"authenticated"}',true);
select public.reserve_finding_photo('99999999-9999-4999-8999-999999999969','88888888-8888-4888-8888-888888888869','image/png',12,repeat('a',64),repeat('b',64));
do $$ begin
  begin
    perform public.apply_operation(gen_random_uuid(),'77777777-7777-4777-8777-777777777769','inspection.finalize','66666666-6666-4666-8666-666666666669',1,'{"expectedFindingIds":["88888888-8888-4888-8888-888888888869"]}');
    raise exception 'SMOKE: incomplete photo allowed finalization';
  exception when raise_exception then if sqlerrm <> 'PHOTOS_PENDING' then raise; end if; end;
  begin
    perform public.complete_finding_photo('99999999-9999-4999-8999-999999999969');
    raise exception 'SMOKE: absent object marked uploaded';
  exception when raise_exception then if sqlerrm <> 'PHOTO_OBJECT_MISSING' then raise; end if; end;
end $$;
-- A fourth reservation is rejected; removing two pending objects releases capacity.
select public.reserve_finding_photo('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa69','88888888-8888-4888-8888-888888888869','image/png',12,repeat('a',64),repeat('b',64));
select public.reserve_finding_photo('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb69','88888888-8888-4888-8888-888888888869','image/png',12,repeat('a',64),repeat('b',64));
do $$ begin
  begin perform public.reserve_finding_photo(gen_random_uuid(),'88888888-8888-4888-8888-888888888869','image/png',12,repeat('a',64),repeat('b',64)); raise exception 'SMOKE: fourth photo accepted'; exception when raise_exception then if sqlerrm <> 'TOO_MANY_PHOTOS' then raise; end if; end;
end $$;
select public.delete_finding_photo('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa69');
select public.delete_finding_photo('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa69',true);
select public.delete_finding_photo('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa69',true);
select public.delete_finding_photo('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb69');
select public.delete_finding_photo('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb69',true);
-- The following only simulates Storage metadata to exercise policies/SQL guards.
insert into storage.objects(bucket_id,name,metadata) values('finding-photos','11111111-1111-4111-8111-111111111169/66666666-6666-4666-8666-666666666669/88888888-8888-4888-8888-888888888869/99999999-9999-4999-8999-999999999969','{"size":12,"mimetype":"image/png"}');
select public.complete_finding_photo('99999999-9999-4999-8999-999999999969');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222269","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.finding_photos where id = '99999999-9999-4999-8999-999999999969') then raise exception 'SMOKE: technician B can read A'; end if;
  if exists(select 1 from storage.objects where name like '%999999999969') then raise exception 'SMOKE: technician B can read object A'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333369","role":"authenticated"}',true);
do $$ begin if exists(select 1 from public.finding_photos where id = '99999999-9999-4999-8999-999999999969') then raise exception 'SMOKE: coordinator reads draft'; end if; end $$;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444469","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.finding_photos where id = '99999999-9999-4999-8999-999999999969') then raise exception 'SMOKE: inactive profile reads photo'; end if;
  begin perform public.reserve_finding_photo(gen_random_uuid(),'88888888-8888-4888-8888-888888888869','image/png',12,repeat('a',64),repeat('b',64)); raise exception 'SMOKE: inactive can write'; exception when raise_exception then if sqlerrm <> 'FORBIDDEN' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111169","role":"authenticated"}',true);
select public.apply_operation(gen_random_uuid(),'77777777-7777-4777-8777-777777777769','inspection.finalize','66666666-6666-4666-8666-666666666669',1,'{"expectedFindingIds":["88888888-8888-4888-8888-888888888869"]}');
do $$ declare affected integer; begin
  update storage.objects set metadata = '{}' where name like '%999999999969'; get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'SMOKE: finalized object overwritten'; end if;
  delete from storage.objects where name like '%999999999969'; get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'SMOKE: finalized object deleted'; end if;
  begin perform public.delete_finding_photo('99999999-9999-4999-8999-999999999969'); raise exception 'SMOKE: finalized photo mutable'; exception when raise_exception then if sqlerrm <> 'VERSION_CONFLICT' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333369","role":"authenticated"}',true);
do $$ begin if not exists(select 1 from public.finding_photos where id = '99999999-9999-4999-8999-999999999969') then raise exception 'SMOKE: coordinator cannot read finalized photo'; end if; end $$;
reset role;
rollback;
