-- Supabase Schema & RPC Functions for MPV Nurse Recruitment 2570
-- Run this entire script in Supabase Dashboard -> SQL Editor -> New Query

create table if not exists public.hr_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.hr_settings (key, value)
values ('hr_pin', '2910')
on conflict (key) do nothing;

create table if not exists public.nurse_applications (
  application_id text primary key,
  status text not null default 'ได้รับใบสมัครแล้ว',
  submitted_at timestamptz not null default now(),
  hr_note text not null default '',
  mobile_number text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nurse_applications_created_at
  on public.nurse_applications (created_at desc);

create table if not exists public.nurse_application_files (
  id text not null,
  application_id text not null references public.nurse_applications (application_id) on delete cascade,
  slot_key text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  data_url text not null,
  created_at timestamptz not null default now(),
  primary key (application_id, id)
);

-- Enable Row Level Security (no direct anonymous SELECT/UPDATE/DELETE on PII tables)
alter table public.hr_settings enable row level security;
alter table public.nurse_applications enable row level security;
alter table public.nurse_application_files enable row level security;

-- Helper: Verify 4-digit HR PIN
create or replace function public.hr_verify_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected text;
begin
  if p_pin is null or p_pin !~ '^\d{4}$' then
    return false;
  end if;

  select value into v_expected
  from public.hr_settings
  where key = 'hr_pin';

  if v_expected is null then
    v_expected := '2910';
  end if;

  return p_pin = v_expected;
end;
$$;

-- Submit (or sync) nurse application + attached files
create or replace function public.submit_nurse_application(
  p_application_id text,
  p_mobile_number text,
  p_status text,
  p_submitted_at timestamptz,
  p_payload jsonb,
  p_files jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_id text := trim(coalesce(p_application_id, ''));
  v_clean_phone text := regexp_replace(coalesce(p_mobile_number, ''), '[\s-]', '', 'g');
  v_status text := coalesce(nullif(trim(p_status), ''), 'ได้รับใบสมัครแล้ว');
  v_file jsonb;
begin
  if v_clean_id = '' or char_length(v_clean_id) > 64 then
    raise exception 'INVALID_APPLICATION_ID';
  end if;

  insert into public.nurse_applications (
    application_id,
    status,
    submitted_at,
    hr_note,
    mobile_number,
    payload,
    created_at,
    updated_at
  )
  values (
    v_clean_id,
    v_status,
    coalesce(p_submitted_at, now()),
    coalesce(p_payload->>'hrNote', ''),
    v_clean_phone,
    p_payload,
    coalesce(p_submitted_at, now()),
    now()
  )
  on conflict (application_id) do update
    set payload = excluded.payload,
        mobile_number = excluded.mobile_number,
        updated_at = now();

  if p_files is not null and jsonb_typeof(p_files) = 'array' then
    for v_file in select * from jsonb_array_elements(p_files)
    loop
      if coalesce(v_file->>'id', '') <> '' and coalesce(v_file->>'dataUrl', '') like 'data:%' then
        insert into public.nurse_application_files (
          id,
          application_id,
          slot_key,
          file_name,
          mime_type,
          size_bytes,
          data_url
        )
        values (
          left(v_file->>'id', 120),
          v_clean_id,
          left(coalesce(v_file->>'slotKey', 'other'), 60),
          left(coalesce(v_file->>'fileName', 'document'), 255),
          left(coalesce(v_file->>'mimeType', 'application/octet-stream'), 120),
          greatest(0, coalesce((v_file->>'sizeBytes')::bigint, 0)),
          v_file->>'dataUrl'
        )
        on conflict (application_id, id) do update
          set file_name = excluded.file_name,
              mime_type = excluded.mime_type,
              size_bytes = excluded.size_bytes,
              data_url = excluded.data_url;
      end if;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'applicationId', v_clean_id);
end;
$$;

-- Track application status by reference code + mobile phone
create or replace function public.track_nurse_application(
  p_code text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_code text := upper(trim(coalesce(p_code, '')));
  v_clean_phone text := regexp_replace(coalesce(p_phone, ''), '[\s-]', '', 'g');
  v_row public.nurse_applications%rowtype;
begin
  if v_clean_code = '' or v_clean_phone = '' then
    return null;
  end if;

  select * into v_row
  from public.nurse_applications
  where upper(application_id) = v_clean_code
    and regexp_replace(mobile_number, '[\s-]', '', 'g') = v_clean_phone
  limit 1;

  if not found then
    return null;
  end if;

  return v_row.payload || jsonb_build_object(
    'applicationId', v_row.application_id,
    'status', v_row.status,
    'submittedAt', v_row.submitted_at,
    'hrNote', v_row.hr_note
  );
end;
$$;

-- HR: List all submitted applications (PIN-gated)
create or replace function public.hr_list_applications(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.hr_verify_pin(p_pin) then
    raise exception 'INVALID_HR_PIN';
  end if;

  select coalesce(
    jsonb_agg(
      (
        a.payload || jsonb_build_object(
          'applicationId', a.application_id,
          'status', a.status,
          'submittedAt', a.submitted_at,
          'hrNote', a.hr_note
        )
      )
      order by a.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.nurse_applications a;

  return v_result;
end;
$$;

-- HR: Update application status & note (PIN-gated)
create or replace function public.hr_update_application_status(
  p_pin text,
  p_application_id text,
  p_status text,
  p_hr_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.nurse_applications%rowtype;
  v_note text := left(trim(coalesce(p_hr_note, '')), 1000);
begin
  if not public.hr_verify_pin(p_pin) then
    raise exception 'INVALID_HR_PIN';
  end if;

  if p_status not in (
    'ได้รับใบสมัครแล้ว',
    'อยู่ระหว่างตรวจสอบเอกสาร',
    'ผ่านการคัดกรองเบื้องต้น',
    'นัดหมายสัมภาษณ์'
  ) then
    raise exception 'INVALID_STATUS';
  end if;

  update public.nurse_applications
  set status = p_status,
      hr_note = v_note,
      payload = payload || jsonb_build_object('status', p_status, 'hrNote', v_note),
      updated_at = now()
  where application_id = p_application_id
  returning * into v_row;

  if not found then
    return null;
  end if;

  return v_row.payload || jsonb_build_object(
    'applicationId', v_row.application_id,
    'status', v_row.status,
    'submittedAt', v_row.submitted_at,
    'hrNote', v_row.hr_note
  );
end;
$$;

-- HR: Delete application and cascaded files (PIN-gated)
create or replace function public.hr_delete_application(
  p_pin text,
  p_application_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.hr_verify_pin(p_pin) then
    raise exception 'INVALID_HR_PIN';
  end if;

  delete from public.nurse_applications
  where application_id = p_application_id;

  return found;
end;
$$;

-- HR: Get single attachment dataUrl (PIN-gated)
create or replace function public.hr_get_application_file(
  p_pin text,
  p_application_id text,
  p_doc_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file public.nurse_application_files%rowtype;
begin
  if not public.hr_verify_pin(p_pin) then
    raise exception 'INVALID_HR_PIN';
  end if;

  select * into v_file
  from public.nurse_application_files
  where application_id = p_application_id
    and id = p_doc_id
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_file.id,
    'fileName', v_file.file_name,
    'mimeType', v_file.mime_type,
    'sizeBytes', v_file.size_bytes,
    'dataUrl', v_file.data_url
  );
end;
$$;

-- HR: Upload / recover missing attachment file (PIN-gated)
create or replace function public.hr_attach_application_file(
  p_pin text,
  p_application_id text,
  p_doc_id text,
  p_slot_key text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_data_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.hr_verify_pin(p_pin) then
    raise exception 'INVALID_HR_PIN';
  end if;

  if coalesce(p_data_url, '') not like 'data:%' then
    raise exception 'INVALID_FILE_DATA';
  end if;

  insert into public.nurse_application_files (
    id,
    application_id,
    slot_key,
    file_name,
    mime_type,
    size_bytes,
    data_url
  )
  values (
    left(p_doc_id, 120),
    p_application_id,
    left(coalesce(p_slot_key, 'other'), 60),
    left(coalesce(p_file_name, 'document'), 255),
    left(coalesce(p_mime_type, 'application/octet-stream'), 120),
    greatest(0, coalesce(p_size_bytes, 0)),
    p_data_url
  )
  on conflict (application_id, id) do update
    set file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        data_url = excluded.data_url;

  return true;
end;
$$;

-- Permissions for client SDK (anon / authenticated)
grant execute on function public.hr_verify_pin(text) to anon, authenticated;
grant execute on function public.submit_nurse_application(text, text, text, timestamptz, jsonb, jsonb) to anon, authenticated;
grant execute on function public.track_nurse_application(text, text) to anon, authenticated;
grant execute on function public.hr_list_applications(text) to anon, authenticated;
grant execute on function public.hr_update_application_status(text, text, text, text) to anon, authenticated;
grant execute on function public.hr_delete_application(text, text) to anon, authenticated;
grant execute on function public.hr_get_application_file(text, text, text) to anon, authenticated;
grant execute on function public.hr_attach_application_file(text, text, text, text, text, text, bigint, text) to anon, authenticated;
