create table members (
  id text primary key,
  realm text not null,
  sub text not null,
  email text not null default '',
  name text not null default '',
  role text not null check (role in ('admin', 'manager', 'member', 'viewer', 'bot')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (realm, sub)
);

create table invites (
  id text primary key,
  realm text not null,
  email text not null default '',
  sub text not null default '',
  role text not null check (role in ('admin', 'manager', 'member', 'viewer')),
  invited_by text not null references members (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);

create index invites_realm_idx on invites (realm, created_at desc);

create table categories (
  id text primary key,
  realm text not null,
  name text not null,
  sort_order integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (realm, name)
);

create table recurrence_rules (
  id text primary key,
  realm text not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  title text not null,
  body text not null default '',
  category_id text not null references categories (id),
  assignee_id text references members (id),
  priority text not null,
  due_time text,
  tags jsonb not null default '[]',
  related_urls jsonb not null default '[]',
  checklist jsonb not null default '[]',
  collaborator_ids jsonb not null default '[]',
  start_on text not null,
  until_on text,
  active boolean not null default true,
  created_by text not null references members (id),
  created_at timestamptz not null default now()
);

create table tasks (
  id text primary key,
  realm text not null,
  title text not null,
  body text not null default '',
  category_id text not null references categories (id),
  assignee_id text references members (id),
  creator_id text not null references members (id),
  start_date text,
  due_date text,
  due_time text,
  due_at timestamptz,
  priority text not null check (priority in ('urgent', 'high', 'normal', 'low')),
  status text not null check (status in ('todo', 'in_progress', 'review', 'hold', 'done')),
  hold_reason text not null default '',
  delay_reason text not null default '',
  tags jsonb not null default '[]',
  related_urls jsonb not null default '[]',
  checklist jsonb not null default '[]',
  version integer not null default 1,
  trashed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recurrence_rule_id text references recurrence_rules (id),
  occurrence_key text
);

create unique index tasks_occurrence_uidx on tasks (realm, occurrence_key) where occurrence_key is not null;
create index tasks_realm_updated_idx on tasks (realm, updated_at desc);
create index tasks_realm_assignee_idx on tasks (realm, assignee_id);
create index tasks_realm_due_idx on tasks (realm, due_date);
create index tasks_realm_status_idx on tasks (realm, status);

create table task_collaborators (
  task_id text not null references tasks (id),
  member_id text not null references members (id),
  primary key (task_id, member_id)
);

create table comments (
  id text primary key,
  realm text not null,
  task_id text not null references tasks (id),
  author_id text not null references members (id),
  body text not null,
  kind text not null check (kind in ('comment', 'progress', 'checkin')),
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index comments_idem_uidx on comments (realm, idempotency_key) where idempotency_key is not null;
create index comments_task_idx on comments (task_id, created_at);

create table task_history (
  id text primary key,
  realm text not null,
  task_id text not null references tasks (id),
  actor_id text not null references members (id),
  actor_kind text not null check (actor_kind in ('human', 'bot')),
  field text not null check (field in ('assignee', 'due', 'status')),
  old_value text not null default '',
  new_value text not null default '',
  created_at timestamptz not null default now()
);

create index task_history_task_idx on task_history (task_id, created_at);
create index task_history_realm_idx on task_history (realm, created_at desc);

create table notifications (
  id text primary key,
  realm text not null,
  recipient_id text not null references members (id),
  task_id text references tasks (id),
  kind text not null,
  title text not null,
  body text not null default '',
  idempotency_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (realm, idempotency_key)
);

create index notifications_recipient_idx on notifications (recipient_id, created_at desc);

create table summaries (
  id text primary key,
  realm text not null,
  period text not null check (period in ('daily', 'weekly')),
  period_key text not null,
  body text not null,
  created_by text not null references members (id),
  created_at timestamptz not null default now(),
  unique (realm, period, period_key)
);

create table bot_settings (
  realm text primary key,
  weekday_summary_time text not null default '09:00',
  weekday_summary_enabled boolean not null default true,
  due_soon_enabled boolean not null default true,
  due_soon_days integer not null default 1,
  overdue_enabled boolean not null default true,
  stale_enabled boolean not null default true,
  stale_business_days integer not null default 3,
  weekly_enabled boolean not null default true,
  weekly_dow integer not null default 4,
  weekly_time text not null default '15:00',
  recurrence_time text not null default '00:10',
  recurrence_enabled boolean not null default true,
  business_days jsonb not null default '[1,2,3,4,5]',
  exclude_holidays boolean not null default false,
  holidays jsonb not null default '[]',
  scope_category_ids jsonb,
  notify_due_soon boolean not null default true,
  notify_overdue boolean not null default true,
  notify_stale boolean not null default true,
  notify_mentions boolean not null default true,
  updated_at timestamptz not null default now()
);

create table job_runs (
  id text primary key,
  realm text not null,
  job_name text not null,
  slot_key text not null,
  status text not null check (status in ('running', 'success', 'failed')),
  error text not null default '',
  detail jsonb not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (realm, job_name, slot_key)
);

create table rate_hits (
  actor_key text not null,
  hit_at timestamptz not null default now()
);

create index rate_hits_idx on rate_hits (actor_key, hit_at);
