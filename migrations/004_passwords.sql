alter table members add column if not exists username text;
alter table members add column if not exists username_norm text;
alter table members add column if not exists password_hash text;
alter table members add column if not exists must_change_password boolean not null default false;
alter table members add column if not exists password_version integer not null default 0;

update members as m
set username = m.email_norm,
    username_norm = m.email_norm
where coalesce(m.username_norm, '') = ''
  and m.email_norm <> ''
  and not exists (
    select 1 from members as other
    where other.stage = m.stage
      and other.email_norm = m.email_norm
      and other.id <> m.id
  );

create unique index if not exists members_username_unique
  on members (stage, username_norm)
  where username_norm is not null and username_norm <> '';

create table if not exists sessions (
  id text primary key,
  stage text not null,
  member_id text not null references members (id),
  token_hash text not null unique,
  csrf_token text not null,
  password_version integer not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sessions_member on sessions (member_id);
