do $$
declare
  name text;
begin
  for name in
    select conname from pg_constraint
    where conrelid = 'tasks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%recurrence_freq%'
  loop
    execute format('alter table tasks drop constraint %I', name);
  end loop;
  alter table tasks add constraint tasks_recurrence_freq_check
    check (recurrence_freq is null or recurrence_freq in ('daily', 'weekly', 'monthly', 'yearly'));
end $$;

update tasks
set work_kind = recurrence_freq
where is_template = true
  and work_kind = 'once'
  and recurrence_freq in ('daily', 'weekly', 'monthly', 'yearly')
  and updated_at = created_at;

update tasks as child
set work_kind = parent.recurrence_freq
from tasks as parent
where child.template_id = parent.id
  and child.work_kind = 'once'
  and parent.recurrence_freq in ('daily', 'weekly', 'monthly', 'yearly')
  and child.updated_at = child.created_at;
