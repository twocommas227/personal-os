-- Enable vector extension for memory layer
create extension if not exists vector;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists entities (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null,
  kind        text not null,       -- person | company | project | etc.
  metadata    jsonb default '{}',
  created_at  timestamptz default now()
);

create table if not exists raw_captures (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  source          text not null,   -- telegram | web | shortcut
  raw_text        text,
  audio_url       text,
  classification  jsonb default '{}',
  llm_source      text,
  routed_to       text,
  routed_id       uuid,
  created_at      timestamptz default now()
);

create table if not exists tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  title             text not null,
  description       text,
  urgency           text not null default 'someday',  -- today | this_week | this_month | someday
  key               boolean default false,
  priority_score    int default 0,
  time_estimate_min int,
  tags              text[] default '{}',
  due_date          date,
  owner             text,
  entity_id         uuid references entities(id) on delete set null,
  completed_at      timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists daily_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  log_date    date not null,
  notes       text,               -- stores JSON blobs for habits/nutrition/finance/goals
  mood        int,                -- 1–5
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(user_id, log_date)
);

create table if not exists memory_chunks (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  source_type  text not null,     -- capture | task | journal | habit | meal
  source_id    uuid,
  text         text not null,
  embedding    vector(1536),
  created_at   timestamptz default now()
);

create table if not exists audit_log (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  action         text not null,
  resource_type  text,
  resource_id    uuid,
  metadata       jsonb default '{}',
  created_at     timestamptz default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists tasks_user_urgency
  on tasks(user_id, urgency)
  where completed_at is null;

create index if not exists daily_logs_user_date
  on daily_logs(user_id, log_date desc);

create index if not exists memory_chunks_embedding
  on memory_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ── Row-level security (deny-all; service role bypasses) ─────────────────────

alter table entities      enable row level security;
alter table raw_captures  enable row level security;
alter table tasks         enable row level security;
alter table daily_logs    enable row level security;
alter table memory_chunks enable row level security;
alter table audit_log     enable row level security;

-- Deny all for authenticated and anon roles — only service role can read/write
create policy "deny all entities"      on entities      for all using (false);
create policy "deny all raw_captures"  on raw_captures  for all using (false);
create policy "deny all tasks"         on tasks         for all using (false);
create policy "deny all daily_logs"    on daily_logs    for all using (false);
create policy "deny all memory_chunks" on memory_chunks for all using (false);
create policy "deny all audit_log"     on audit_log     for all using (false);
