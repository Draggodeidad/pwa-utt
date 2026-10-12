-- Disposable LOCAL PostgreSQL only. Never run in Supabase Dashboard.
-- Minimal Auth/Storage stand-ins; no HTTP service or production fidelity.
do $$ begin if to_regclass('auth.users') is not null then raise exception 'Refusing bootstrap: auth.users already exists'; end if; end $$;
create role anon; create role authenticated;
create schema auth; create schema extensions; create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid $$;
grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
create schema storage;
create table storage.buckets(id text primary key, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon; grant select, insert, update, delete on storage.objects to authenticated;
insert into storage.buckets values('finding-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
