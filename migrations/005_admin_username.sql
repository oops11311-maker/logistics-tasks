update members
set username = null,
    username_norm = null,
    updated_at = now()
where username_norm = 'limjaeyeol'
  and email_norm is distinct from 'oops11311@gmail.com'
  and coalesce(username_norm, '') is distinct from 'oops11311@gmail.com';

update members as m
set username = 'limjaeyeol',
    username_norm = 'limjaeyeol',
    updated_at = now()
where m.id in (
  select picked.id
  from (
    select distinct on (stage) id
    from members
    where email_norm = 'oops11311@gmail.com' or username_norm = 'oops11311@gmail.com'
    order by stage, case when role = 'admin' then 0 else 1 end, created_at
  ) as picked
)
  and coalesce(m.username_norm, '') is distinct from 'limjaeyeol';
