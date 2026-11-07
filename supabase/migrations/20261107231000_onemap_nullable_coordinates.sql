-- OneMap's planning-area endpoint provides identifiers and names, but not
-- point coordinates for every area. Keep coordinates optional for new rows.
alter table public.neighbourhoods
  alter column lat drop not null,
  alter column lng drop not null;
