create table if not exists setup_challenges (
  id text primary key,
  token_hash text not null unique,
  csrf_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists setup_challenges_expires on setup_challenges (expires_at);
