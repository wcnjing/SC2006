-- Demo data helper: place scheduled activities between now and the end of
-- the current Singapore month while preserving each activity's duration.
with bounds as (
  select
    now() as start_at,
    timezone(
      'Asia/Singapore',
      date_trunc('month', timezone('Asia/Singapore', now()))
        + interval '1 month'
        - interval '1 second'
    ) as end_at
),
durations as (
  select
    a.id,
    greatest(a.ends_at - a.starts_at, interval '1 hour') as duration
  from public.activities a
  where a.status = 'scheduled'
),
randomized as (
  select
    d.id,
    b.start_at
      + random() * greatest(
          b.end_at - b.start_at - d.duration,
          interval '1 second'
        ) as new_start,
    d.duration
  from durations d
  cross join bounds b
)
update public.activities a
set
  starts_at = r.new_start,
  ends_at = r.new_start + r.duration
from randomized r
where a.id = r.id;
