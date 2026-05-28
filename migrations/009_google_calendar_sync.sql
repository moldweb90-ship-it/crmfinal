create table if not exists google_calendar_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  calendar_id text not null,
  ical_url text,
  doctor_id uuid,
  clinic_id text,
  color_code text default '#4285f4',
  sync_mode text default 'read_only',
  is_active boolean default true,
  last_synced_at timestamptz,
  sync_token text,
  refresh_token_encrypted text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists google_calendar_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid,
  google_event_id text not null,
  calendar_id text not null,
  doctor_id uuid,
  clinic_id text,
  patient_name text,
  service_name text,
  description text,
  location text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text default 'confirmed',
  html_link text,
  raw_payload jsonb,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(calendar_id, google_event_id)
);

