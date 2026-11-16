create table if not exists members (
  id text primary key,
  stage text not null,
  subject text not null,
  email text not null default '',
  email_norm text not null default '',
  name text not null default '',
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  unique (stage, subject),
  check (role in ('admin', 'manager', 'member', 'viewer', 'bot'))
);

create table if not exists invites (
  id text primary key,
  stage text not null,
  email text not null,
  email_norm text not null,
  role text not null,
  created_by text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (role in ('admin', 'manager', 'member', 'viewer'))
);

create unique index if not exists invites_open_email
  on invites (stage, email_norm)
  where accepted_at is null;

create table if not exists categories (
  id text primary key,
  stage text not null,
  name text not null,
  sort_order int not null,
  archived boolean not null default false,
  unique (stage, name)
);

create table if not exists tasks (
  id text primary key,
  stage text not null,
  title text not null,
  body text not null default '',
  category_id text references categories (id),
  owner_id text not null references members (id),
  creator_id text not null references members (id),
  start_date date,
  due_date date,
  due_time text,
  due_at timestamptz,
  priority text not null,
  status text not null,
  checklist jsonb not null default '[]',
  tags jsonb not null default '[]',
  links jsonb not null default '[]',
  hold_reason text,
  delay_reason text,
  version int not null default 1,
  deleted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_template boolean not null default false,
  template_id text,
  occurrence_key text,
  recurrence_freq text,
  recurrence_interval int,
  recurrence_business_days boolean,
  recurrence_dom int,
  recurrence_until date,
  next_run_on date,
  check (priority in ('긴급', '높음', '보통', '낮음')),
  check (status in ('할 일', '진행 중', '확인 요청', '보류', '완료')),
  check (recurrence_freq is null or recurrence_freq in ('daily', 'weekly', 'monthly'))
);

create unique index if not exists tasks_occurrence_unique
  on tasks (stage, template_id, occurrence_key)
  where template_id is not null;

create index if not exists tasks_stage_list on tasks (stage, deleted_at, is_template, status);
create index if not exists tasks_owner on tasks (stage, owner_id);
create index if not exists tasks_due on tasks (stage, due_date);
create index if not exists tasks_updated on tasks (stage, updated_at desc);

create table if not exists task_collaborators (
  task_id text not null references tasks (id),
  member_id text not null references members (id),
  primary key (task_id, member_id)
);

create table if not exists comments (
  id text primary key,
  stage text not null,
  task_id text not null references tasks (id),
  author_id text not null references members (id),
  body text not null,
  kind text not null default 'comment',
  created_at timestamptz not null default now(),
  check (kind in ('comment', 'progress_check', 'proposal'))
);

create index if not exists comments_task on comments (task_id, created_at);

create table if not exists task_events (
  id text primary key,
  stage text not null,
  task_id text not null references tasks (id),
  actor_id text references members (id),
  actor_kind text not null,
  action text not null,
  field text,
  old_value text,
  new_value text,
  created_at timestamptz not null default now(),
  check (actor_kind in ('human', 'bot'))
);

create index if not exists task_events_task on task_events (task_id, created_at);
create index if not exists task_events_stage on task_events (stage, created_at desc);

create table if not exists notifications (
  id text primary key,
  stage text not null,
  member_id text not null references members (id),
  task_id text references tasks (id),
  kind text not null,
  title text not null,
  body text not null default '',
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_member on notifications (stage, member_id, created_at desc);

create table if not exists summaries (
  id text primary key,
  stage text not null,
  kind text not null,
  period_key text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (stage, period_key)
);

create table if not exists alerts (
  id text primary key,
  stage text not null,
  task_id text references tasks (id),
  member_id text references members (id),
  kind text not null,
  body text not null,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists job_runs (
  id text primary key,
  stage text not null,
  source text not null,
  job_name text not null,
  status text not null,
  error text,
  detail jsonb not null default '{}',
  idempotency_key text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create unique index if not exists job_runs_idem
  on job_runs (stage, idempotency_key)
  where idempotency_key is not null;

create table if not exists job_state (
  stage text not null,
  job_name text not null,
  last_success_at timestamptz,
  last_success_slot text,
  last_error_at timestamptz,
  last_error text,
  retry_count int not null default 0,
  next_due_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (stage, job_name)
);

create table if not exists settings (
  stage text not null,
  key text not null,
  value jsonb not null,
  primary key (stage, key)
);

create table if not exists holidays (
  stage text not null,
  day date not null,
  name text not null,
  primary key (stage, day)
);

create table if not exists rate_limits (
  actor_key text not null,
  window_start timestamptz not null,
  count int not null,
  primary key (actor_key, window_start)
);

insert into categories (id, stage, name, sort_order) values
  ('cat-prod-supplier', 'production', '신규공급사', 1),
  ('cat-prod-reorder', 'production', '리오더', 2),
  ('cat-prod-3pl', 'production', '3PL', 3),
  ('cat-prod-ops', 'production', '상품 운영', 4),
  ('cat-prod-system', 'production', '시스템 개선', 5),
  ('cat-prod-other', 'production', '기타', 6),
  ('cat-prev-supplier', 'preview', '신규공급사', 1),
  ('cat-prev-reorder', 'preview', '리오더', 2),
  ('cat-prev-3pl', 'preview', '3PL', 3),
  ('cat-prev-ops', 'preview', '상품 운영', 4),
  ('cat-prev-system', 'preview', '시스템 개선', 5),
  ('cat-prev-other', 'preview', '기타', 6)
on conflict (stage, name) do nothing;

insert into members (id, stage, subject, email, email_norm, name, role, active) values
  ('bot-prod', 'production', 'bot:logistics', '', '', '물류 봇', 'bot', true),
  ('bot-prev', 'preview', 'bot:logistics', '', '', '물류 봇', 'bot', true)
on conflict (stage, subject) do nothing;

insert into settings (stage, key, value) values
  ('production', 'exclude_holidays', 'false'::jsonb),
  ('preview', 'exclude_holidays', 'false'::jsonb),
  ('production', 'meta', '{"revision":1}'::jsonb),
  ('preview', 'meta', '{"revision":1}'::jsonb),
  ('production', 'bot', '{"summaryTime":"09:00","summaryWeekdays":[1,2,3,4,5],"dueSoonBusinessDays":1,"staleBusinessDays":3,"overdueAlerts":true,"weeklyWeekday":4,"weeklyTime":"15:00","categoryIds":[]}'::jsonb),
  ('preview', 'bot', '{"summaryTime":"09:00","summaryWeekdays":[1,2,3,4,5],"dueSoonBusinessDays":1,"staleBusinessDays":3,"overdueAlerts":true,"weeklyWeekday":4,"weeklyTime":"15:00","categoryIds":[]}'::jsonb),
  ('production', 'notifications', '{"inApp":true,"dueSoon":true,"overdue":true,"stale":true,"mentions":true}'::jsonb),
  ('preview', 'notifications', '{"inApp":true,"dueSoon":true,"overdue":true,"stale":true,"mentions":true}'::jsonb)
on conflict (stage, key) do nothing;

insert into job_state (stage, job_name) values
  ('production', 'recurrence'),
  ('production', 'morning'),
  ('production', 'weekly'),
  ('preview', 'recurrence'),
  ('preview', 'morning'),
  ('preview', 'weekly')
on conflict (stage, job_name) do nothing;
