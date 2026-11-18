create unique index if not exists members_email_unique
  on members (stage, email_norm)
  where email_norm <> '';

create table if not exists member_audit (
  id text primary key,
  stage text not null,
  member_id text not null,
  actor_id text not null,
  action text not null,
  before_value text not null default '',
  after_value text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists member_audit_member
  on member_audit (member_id, created_at);
