alter table tasks add column if not exists work_kind text not null default 'once';

update tasks set work_kind = 'daily'
where work_kind = 'once'
  and updated_at = created_at
  and (
    recurrence_freq = 'daily'
    or template_id in (select id from tasks where recurrence_freq = 'daily')
  );
