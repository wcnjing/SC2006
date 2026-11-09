-- Keep the database id used by existing foreign keys, while storing the
-- stable identifier returned by OneMap for monthly synchronisation.
alter table public.neighbourhoods
  add column if not exists onemap_id text unique;

alter table public.neighbourhoods
  alter column lat drop not null,
  alter column lng drop not null;

grant select on public.neighbourhoods to anon, authenticated;
