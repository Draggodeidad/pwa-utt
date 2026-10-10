-- W06 #69. Apply after creating the PRIVATE finding-photos bucket in Dashboard.
-- All object writes/deletes use Storage API; never mutate storage.objects here.
begin;
do $$ begin
  if not exists (select 1 from storage.buckets where id = 'finding-photos' and not public
    and file_size_limit = 5242880 and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]
    and allowed_mime_types <@ array['image/jpeg','image/png','image/webp']::text[]) then
    raise exception 'Create private finding-photos bucket: 5242880 bytes, JPEG/PNG/WebP first';
  end if;
end $$;

create table public.finding_photos (
  id uuid primary key,
  finding_id uuid not null references public.findings(id),
  inspection_id uuid not null references public.inspections(id),
  owner_user_id uuid not null references public.profiles(id),
  bucket text not null default 'finding-photos' check (bucket = 'finding-photos'),
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  bytes integer not null check (bytes between 1 and 5242880),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending' check (state in ('pending','uploaded','deleting','deleted')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index finding_photos_finding on public.finding_photos(finding_id);
create index finding_photos_inspection on public.finding_photos(inspection_id);
alter table public.finding_photos enable row level security;

create function public.can_read_finding_photo(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.finding_photos p
    join public.findings f on f.id = p.finding_id and f.inspection_id = p.inspection_id
    join public.inspections i on i.id = p.inspection_id
    where p.id = p_id and p.state <> 'deleted' and f.deleted_at is null and i.deleted_at is null
      and public.is_active_user() and (
        p.owner_user_id = auth.uid() and i.inspector_id = auth.uid()
        or public.is_coordinator() and i.workflow_status = 'completed' and p.state = 'uploaded'));
$$;
create policy finding_photos_read on public.finding_photos for select to authenticated
using (public.can_read_finding_photo(id));
grant select on public.finding_photos to authenticated;
revoke all on public.finding_photos from anon;

create function public.reserve_finding_photo(p_id uuid, p_finding_id uuid, p_mime text,
  p_bytes integer, p_source_hash text, p_content_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.inspections; f public.findings; p public.finding_photos; path text;
begin
  if not public.is_technician() then raise exception 'FORBIDDEN'; end if;
  select * into f from public.findings where id = p_finding_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into i from public.inspections where id = f.inspection_id for update;
  -- Re-read after the parent lock: concurrent finding deletion is serialized here.
  select * into f from public.findings where id = p_finding_id;
  if i.inspector_id <> auth.uid() or i.deleted_at is not null or f.deleted_at is not null then raise exception 'NOT_FOUND'; end if;
  select * into p from public.finding_photos where id = p_id;
  if found then
    if p.owner_user_id <> auth.uid() or p.finding_id <> p_finding_id or p.mime_type <> p_mime
      or p.bytes <> p_bytes or p.source_hash <> p_source_hash or p.content_hash <> p_content_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    if p.state = 'uploaded' then return to_jsonb(p) || '{"__replayed":true}'::jsonb; end if;
    if p.state <> 'pending' then raise exception 'VERSION_CONFLICT'; end if;
  end if;
  if i.workflow_status <> 'draft' then raise exception 'VERSION_CONFLICT'; end if;
  if p.id is not null then return to_jsonb(p); end if;
  if (select count(*) from public.finding_photos where finding_id = f.id and state <> 'deleted') >= 3 then
    raise exception 'TOO_MANY_PHOTOS'; end if;
  path := auth.uid()::text || '/' || i.id::text || '/' || f.id::text || '/' || p_id::text;
  insert into public.finding_photos(id, finding_id, inspection_id, owner_user_id, object_path, mime_type, bytes, source_hash, content_hash)
    values(p_id, f.id, i.id, auth.uid(), path, p_mime, p_bytes, p_source_hash, p_content_hash) returning * into p;
  return to_jsonb(p);
end $$;

create function public.complete_finding_photo(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.finding_photos; i public.inspections;
begin
  if not public.is_technician() then raise exception 'FORBIDDEN'; end if;
  select * into p from public.finding_photos where id = p_id;
  if not found or p.owner_user_id <> auth.uid() then raise exception 'NOT_FOUND'; end if;
  select * into i from public.inspections where id = p.inspection_id for update;
  select * into p from public.finding_photos where id = p_id for update;
  if p.state = 'uploaded' then return to_jsonb(p) || '{"__replayed":true}'::jsonb; end if;
  if i.workflow_status <> 'draft' or i.deleted_at is not null or p.state <> 'pending'
    or not exists(select 1 from public.findings where id = p.finding_id and deleted_at is null) then raise exception 'VERSION_CONFLICT'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id = p.bucket and o.name = p.object_path
    and (o.metadata->>'size')::bigint = p.bytes and o.metadata->>'mimetype' = p.mime_type) then raise exception 'PHOTO_OBJECT_MISSING'; end if;
  update public.finding_photos set state = 'uploaded', version = version + 1, updated_at = now() where id = p_id returning * into p;
  return to_jsonb(p);
end $$;

create function public.delete_finding_photo(p_id uuid, p_complete boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.finding_photos; i public.inspections;
begin
  if not public.is_technician() then raise exception 'FORBIDDEN'; end if;
  select * into p from public.finding_photos where id = p_id;
  if not found or p.owner_user_id <> auth.uid() then raise exception 'NOT_FOUND'; end if;
  select * into i from public.inspections where id = p.inspection_id for update;
  select * into p from public.finding_photos where id = p_id for update;
  if p.state = 'deleted' then return to_jsonb(p) || '{"__replayed":true}'::jsonb; end if;
  if i.workflow_status <> 'draft' or i.deleted_at is not null then raise exception 'VERSION_CONFLICT'; end if;
  if p_complete then
    if p.state <> 'deleting' or exists (select 1 from storage.objects where bucket_id = p.bucket and name = p.object_path) then raise exception 'PHOTO_OBJECT_EXISTS'; end if;
    update public.finding_photos set state = 'deleted', version = version + 1, updated_at = now() where id = p_id returning * into p;
  else
    update public.finding_photos set state = 'deleting', updated_at = now() where id = p_id returning * into p;
  end if;
  return to_jsonb(p);
end $$;

-- This guard also covers writes via the accumulated apply_operation RPC.
create function public.guard_photo_parent_mutation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'inspections' then
    if new.workflow_status = 'completed' and old.workflow_status <> 'completed' and exists (
      select 1 from public.finding_photos p where p.inspection_id = new.id and p.state in ('pending','deleting')) then
      raise exception 'PHOTOS_PENDING'; end if;
    if new.deleted_at is not null and old.deleted_at is null and exists (
      select 1 from public.finding_photos p where p.inspection_id = new.id and p.state <> 'deleted') then raise exception 'PHOTOS_PENDING'; end if;
  else
    if new.deleted_at is not null and old.deleted_at is null and exists (
      select 1 from public.finding_photos p where p.finding_id = new.id and p.state <> 'deleted') then raise exception 'PHOTOS_PENDING'; end if;
  end if;
  return new;
end $$;
create trigger inspections_photos_guard before update on public.inspections
for each row execute function public.guard_photo_parent_mutation();
create trigger findings_photos_guard before update on public.findings
for each row execute function public.guard_photo_parent_mutation();

create function public.can_write_photo_object(p_path text, p_delete boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.finding_photos p
    join public.findings f on f.id = p.finding_id and f.inspection_id = p.inspection_id
    join public.inspections i on i.id = p.inspection_id
    where p.object_path = p_path and p.owner_user_id = auth.uid() and i.inspector_id = auth.uid()
      and public.is_technician() and i.workflow_status = 'draft' and i.deleted_at is null and f.deleted_at is null
      and p.state = case when p_delete then 'deleting' else 'pending' end);
$$;
create policy finding_photos_storage_read on storage.objects for select to authenticated
using (bucket_id = 'finding-photos' and exists(select 1 from public.finding_photos p
  where p.object_path = name and public.can_read_finding_photo(p.id)));
create policy finding_photos_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'finding-photos' and public.can_write_photo_object(name, false));
create policy finding_photos_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'finding-photos' and public.can_write_photo_object(name, true));
-- Deliberately NO UPDATE policy: neither retries nor finalization overwrite bytes.

revoke all on function public.can_read_finding_photo(uuid), public.can_write_photo_object(text, boolean),
  public.reserve_finding_photo(uuid, uuid, text, integer, text, text), public.complete_finding_photo(uuid),
  public.delete_finding_photo(uuid, boolean), public.guard_photo_parent_mutation() from public, anon;
grant execute on function public.can_read_finding_photo(uuid), public.can_write_photo_object(text, boolean),
  public.reserve_finding_photo(uuid, uuid, text, integer, text, text), public.complete_finding_photo(uuid),
  public.delete_finding_photo(uuid, boolean) to authenticated;
commit;
