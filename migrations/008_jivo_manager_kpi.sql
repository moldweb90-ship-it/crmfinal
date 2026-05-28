create table if not exists managers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  role text default 'manager',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists jivo_conversations (
  id uuid primary key default gen_random_uuid(),
  jivo_chat_id text unique,
  channel text,
  source text,
  manager_id text,
  manager_name text,
  client_name text,
  client_phone text,
  status text default 'active',
  started_at timestamptz,
  accepted_at timestamptz,
  first_response_at timestamptz,
  finished_at timestamptz,
  response_seconds integer,
  messages_count integer default 0,
  calls_count integer default 0,
  consultation_count integer default 0,
  appointment_created boolean default false,
  sale_closed boolean default false,
  sale_amount numeric default 0,
  lead_id uuid,
  patient_id uuid,
  raw_payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists jivo_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  jivo_chat_id text,
  manager_id text,
  payload jsonb not null,
  received_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists manager_kpi_targets (
  id uuid primary key default gen_random_uuid(),
  manager_id text not null,
  new_leads integer default 0,
  avg_response_seconds integer default 120,
  calls integer default 0,
  consultations integer default 0,
  appointments integer default 0,
  closed_sales integer default 0,
  sales_amount numeric default 0,
  conversion_percent integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

