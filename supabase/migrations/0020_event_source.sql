-- Where an imported event came from (the BTA timetable: "bta:BTA926A:lesson:<id>"), so importing the
-- timetable again replaces what the last import made instead of adding everything twice. Events you
-- make yourself have none. Changed copies and split series keep their series' source.

alter table public.events
  add column if not exists source text;

alter table public.events drop constraint if exists events_source_small;
alter table public.events add constraint events_source_small check (source is null or char_length(source) between 1 and 120);

create index if not exists events_user_source_idx on public.events (user_id, source) where source is not null;
