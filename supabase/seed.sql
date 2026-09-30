-- Phase 04: synthetic catalog. Run as project administrator after the migration.
-- Safe to repeat; fixed UUIDs identify these three test laboratories.
begin;
insert into public.laboratories (id, code, name, building, floor)
values
  ('11111111-1111-4111-8111-111111111111', 'LAB-A', 'Laboratorio sintético A', 'Edificio A', '1'),
  ('22222222-2222-4222-8222-222222222222', 'LAB-B', 'Laboratorio sintético B', 'Edificio B', '2'),
  ('33333333-3333-4333-8333-333333333333', 'LAB-C', 'Laboratorio sintético C', 'Edificio C', '1')
on conflict (id) do nothing;
commit;

-- After the schema and catalog are applied in the authorized test project:
-- 1. In Supabase Dashboard > Authentication > Users, create one synthetic
--    technician and one synthetic coordinator with fictional email/password.
--    Do not put credentials in SQL, Git, or test output. The Auth trigger creates
--    both profiles as technician, even if signup metadata says coordinator.
-- 2. Copy only the coordinator's UUID from Dashboard. In SQL Editor, check that
--    its profile exists and has role technician, then run the following statement
--    with that one UUID substituted. Do not elevate by email or metadata.
-- update public.profiles set role = 'coordinator'
--   where id = '<COORDINATOR_AUTH_UUID>'::uuid and role = 'technician';
-- Confirm exactly one row was updated and the technician remained technician.
-- 3. For phase-07/21/26 A/B tests, create a separate temporary synthetic Auth
--    account `tec2` through Dashboard. Its trigger profile stays technician.
--    It is not part of the two-account demo; remove it after those tests.
