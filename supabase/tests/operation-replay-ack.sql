-- Phase 18: verify the same receipt returns replay metadata without changing its result.
begin;

do $test$
declare
  v_actor uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_entity uuid := gen_random_uuid();
  v_operation uuid := gen_random_uuid();
  v_first jsonb;
  v_replay jsonb;
  v_stored jsonb;
  v_conflict boolean := false;
begin
  insert into auth.users (id, raw_user_meta_data) values (v_actor, '{}'::jsonb);
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_actor::text, 'role', 'authenticated')::text, true);

  v_first := public.apply_operation(v_operation, v_client, 'inspection.create', v_entity, null, '{"summary":"Primera"}'::jsonb);
  v_replay := public.apply_operation(v_operation, v_client, 'inspection.create', v_entity, null, '{"summary":"Primera"}'::jsonb);
  if v_first ->> '__replayed' <> 'false' or v_replay ->> '__replayed' <> 'true' then
    raise exception 'Replay marker is wrong: first %, replay %', v_first, v_replay;
  end if;
  if (v_first - '__replayed') <> (v_replay - '__replayed') then
    raise exception 'Replay changed the receipt result';
  end if;
  reset role;
  select result into v_stored from public.operation_receipts where actor_id = v_actor and operation_id = v_operation;
  if v_stored ? '__replayed' then raise exception 'Marker leaked into stored receipt'; end if;
  if (select count(*) from public.inspections where id = v_entity) <> 1 then raise exception 'Duplicate entity'; end if;
  set local role authenticated;
  begin
    perform public.apply_operation(v_operation, v_client, 'inspection.create', v_entity, null, '{"summary":"Changed"}'::jsonb);
  exception when others then
    v_conflict := sqlerrm = 'IDEMPOTENCY_KEY_REUSED';
  end;
  if not v_conflict then raise exception 'Different content must fail'; end if;
end $test$;

rollback;
select 'phase-18 replay ACK passed' as result;
