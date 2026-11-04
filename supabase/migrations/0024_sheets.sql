-- Spreadsheets (pages of kind 'sheet', "Tabellen"): cells with values and formulas, smart tables
-- and charts with trendlines. See src/sheet.
--
-- The whole workbook (its sheets, cells, charts and smart tables) lives in pages.content as JSON
-- (src/sheet/types.ts), next to a small preview for lists (content.preview: the first rows as they
-- show, src/sheet/doc.ts). pages.plain_text keeps the words for search. Saving works like
-- presentations: each save names the revision it builds on (pages.rev); when someone else saved in
-- between, save_sheet() hands back their content and the browser merges cell by cell and saves
-- again (src/sheet/collab.ts). Realtime already tells everyone on the page about new saves.
--
-- Also here, for every page: the rules save_sheet(), save_deck() and save_note_snapshot() keep hold
-- for plain table writes too (pages_guard: a page's kind stays, its revision only moves on by one, a
-- note's version of working together moves on through save_note_snapshot only, a spreadsheet's
-- content changes through save_sheet only, and a new one must be small enough to save); content
-- that would be a burden to everyone who reads it is refused (content_problem); and steps of
-- working together (push_steps) are for notes only.
--
-- Written so it can be run again safely.

alter table public.pages drop constraint if exists pages_kind_check;
alter table public.pages add constraint pages_kind_check check (kind in ('note', 'deck', 'cv', 'folder', 'ink', 'sheet'));

-- The newest saves of a spreadsheet (save_sheet's p_save_id). A browser whose save went out but
-- whose answer never came (the connection dropped, the tab was closed) looks its id up here before
-- it merges what it kept: if that save landed, the merge starts from what it sent, so a newer change
-- made elsewhere since then isn't overwritten. Each browser names its own last save that went
-- through (p_last_save, which it remembers on the device), and its new id takes that one's place:
-- so there is about one id per device and open tab, not one per visit. The newest 200 are kept.
alter table public.pages add column if not exists save_ids uuid[] not null default '{}';
alter table public.pages drop constraint if exists pages_save_ids_check;
alter table public.pages add constraint pages_save_ids_check check (cardinality(save_ids) <= 200);

-- Steps of working together are for notes only (push_steps): on any other page they would block
-- its saves (pages_guard), and nothing in the app puts them there. Any that were put there go.
delete from public.page_steps s using public.pages p where p.id = s.page_id and p.kind <> 'note';

/**
 * Whether content is fit to store where everyone the page is shared with reads it (the lists read
 * every page's content->preview, opening a page reads all of it). jsonb keeps numbers without
 * exponents, and a zero with as many decimal places as it was written with: 1e99 is stored as a 1
 * and 99 zeros, 9e131071 as 131,072 digits, 0e-16383 as "0." and 16,383 zeros, so a few bytes sent
 * could become gigabytes to read. Only the numbers that print long can do that: from 1e16 on, below
 * 1e-15, and zeros with more than 15 decimal places (any other number prints at most 4 times as long
 * as it was written: 1e15 as 16 digits). Returns
 * - 'invalid' when one of them is a number no browser can write: beyond the largest double, between
 *   zero and the smallest one, or with more than 340 decimal places (6.6e-34, 1e-310 and 5e-324 are
 *   fine, and so is 5e-324 written with all 17 digits, 4.9406564584124654e-324, which has 340
 *   places; browsers write zero as 0);
 * - 'too_big' when they would take more than 10,000,000 bytes as text;
 * - null when it's fine.
 * Content without such numbers is walked through once and never printed (lab values, a note's
 * levels and widths), so ordinary saves stay quick. (How big a spreadsheet may be in all is for
 * save_sheet and pages_add_guard to say; other pages have no limit of their own.)
 */
create or replace function public.content_problem(p_content jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  n jsonb;
  x numeric;
  printed bigint := 0;
begin
  -- The numbers to look at come as one array: one row each (jsonb_path_query) would take time
  -- growing with the square of their number, and every zero is one of them (a spreadsheet with
  -- 100,000 cells of 0 would take seconds to add). Zeros print short up to 15 decimal places (17
  -- characters, as long as 1e-15 prints), never far longer than they were sent: they are left out
  -- right away.
  for n in
    select e.v from jsonb_array_elements(jsonb_path_query_array(p_content, 'strict $.** ? (@.abs() >= 1e16 || @.abs() < 1e-15)')) as e(v)
    where e.v <> '0' or scale(e.v::numeric) > 15
  loop
    x := abs(n::numeric);
    if x > 1.7976931348623157e308 or (x <> 0 and x < 4.9406564584124654e-324) or scale(x) > 340 then
      return 'invalid';
    end if;
    printed := printed + octet_length(n::text);
    if printed > 10000000 then
      return 'too_big';
    end if;
  end loop;
  return null;
end;
$$;

revoke execute on function public.content_problem(jsonb) from public, anon, authenticated;

-- The first version of this file took the content as jsonb (never released).
drop function if exists public.save_sheet(uuid, integer, jsonb, text, text);

/**
 * Save a spreadsheet when nobody else saved since revision p_rev. Otherwise returns the newer
 * content, so the browser merges and tries again. Owners and editors only.
 *
 * - p_content is json, not jsonb, so its size is measured as the browser sent it: more than
 *   5,000,000 bytes is refused (too_big), the limit the browser checks too (src/components/sheet/
 *   saver.ts), so one page stays quick to load, save and calculate. It is stored as jsonb, which
 *   prints spaces and numbers without exponents (lab values about 15 % longer, tiny numbers more):
 *   more than 10,000,000 bytes stored is refused too (too_big), and so is a number no browser can
 *   write (invalid, content_problem).
 * - The title is written only when the browser changed it, i.e. p_title differs from p_base_title,
 *   the title it last had from the server: a rename made elsewhere meanwhile stays. The title
 *   stored is returned either way.
 * - p_save_id names this save. It goes into pages.save_ids in place of p_last_save, the same
 *   browser's last save that went through, so each device keeps its newest one there.
 *
 * Returns {ok, rev, title} or {ok: false, reason: 'denied' | 'too_big' | 'invalid'} or
 * {ok: false, reason: 'behind', rev, content, title}.
 */
create or replace function public.save_sheet(
  p_page uuid,
  p_rev integer,
  p_content json,
  p_title text,
  p_plain text,
  p_base_title text default null,
  p_save_id uuid default null,
  p_last_save uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur public.pages;
  doc jsonb;
  long_numbers boolean;
  problem text;
  next_title text;
  ids uuid[];
begin
  if coalesce(public.page_role(p_page), '') not in ('owner', 'editor') then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  -- (A revision at the integer maximum could never move on.)
  if p_content is null or json_typeof(p_content) <> 'object' or p_rev is null or p_rev < 0 or p_rev >= 2147483647 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if octet_length(p_content::text) > 5000000 then
    return jsonb_build_object('ok', false, 'reason', 'too_big');
  end if;
  doc := p_content::jsonb;
  -- Only a number written with an exponent of 16 or more (either way: 6.6e-34, 6e+23) can print
  -- much longer than it was sent, so the JSON as sent says when to look closer (a quick search;
  -- ordinary lab values such as 1.2e-9 don't need it).
  long_numbers := p_content::text ~ '[0-9][eE][-+]?0*([1-9][0-9]{2,}|[2-9][0-9]|1[6-9])';
  if long_numbers then
    problem := public.content_problem(doc);
    if problem is not null then
      return jsonb_build_object('ok', false, 'reason', problem);
    end if;
  end if;
  -- Then what all of it prints as. Without such numbers that is at most 3.6 times what was sent
  -- (1e15, written in 4 characters, prints as 16 digits), so it is printed to measure only when it
  -- could take more than 10,000,000 bytes.
  if (long_numbers or octet_length(p_content::text) > 2700000) and octet_length(doc::text) > 10000000 then
    return jsonb_build_object('ok', false, 'reason', 'too_big');
  end if;
  select * into cur from public.pages where id = p_page for update;
  if cur.kind is distinct from 'sheet' then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  if cur.rev is distinct from p_rev then
    return jsonb_build_object('ok', false, 'reason', 'behind', 'rev', cur.rev, 'content', cur.content, 'title', cur.title);
  end if;
  next_title := case
    when p_base_title is null or p_title is distinct from p_base_title then left(coalesce(p_title, ''), 200)
    else cur.title
  end;
  ids := cur.save_ids;
  if p_save_id is not null then
    ids := array_remove(array_remove(ids, p_last_save), p_save_id) || p_save_id;
    ids := ids[greatest(1, cardinality(ids) - 199):];
  end if;
  -- pages_guard lets this function (and only this one) write a spreadsheet's content and save ids,
  -- and leaves the content's check to it (done above).
  perform set_config('blob.saving_sheet', 'on', true);
  update public.pages
  set content = doc, title = next_title, plain_text = left(coalesce(p_plain, ''), 20000), rev = p_rev + 1, save_ids = ids
  where id = p_page;
  perform set_config('blob.saving_sheet', '', true);
  return jsonb_build_object('ok', true, 'rev', p_rev + 1, 'title', next_title);
end;
$$;

revoke execute on function public.save_sheet(uuid, integer, json, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.save_sheet(uuid, integer, json, text, text, text, uuid, uuid) to authenticated;

/**
 * Save a presentation when nobody else saved since revision p_rev (0010_notes_projects_together.sql),
 * now also refusing a revision that could never move on.
 */
create or replace function public.save_deck(p_page uuid, p_rev integer, p_content jsonb, p_title text, p_plain text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur public.pages;
begin
  if coalesce(public.page_role(p_page), '') not in ('owner', 'editor') then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  if p_rev is null or p_rev < 0 or p_rev >= 2147483647 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select * into cur from public.pages where id = p_page for update;
  if cur.kind <> 'deck' then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  if cur.rev <> p_rev then
    return jsonb_build_object('ok', false, 'reason', 'behind', 'rev', cur.rev, 'content', cur.content, 'title', cur.title);
  end if;
  update public.pages
  set content = p_content, title = left(coalesce(p_title, ''), 200), plain_text = left(coalesce(p_plain, ''), 20000), rev = p_rev + 1
  where id = p_page;
  return jsonb_build_object('ok', true, 'rev', p_rev + 1);
end;
$$;

-- Notes edited together -----------------------------------------------------------------------------

/**
 * Add a note's steps on top of version p_version (0010_notes_projects_together.sql), now for notes
 * only: steps on a presentation or a spreadsheet would block every save of it (pages_guard).
 */
create or replace function public.push_steps(p_page uuid, p_version integer, p_steps jsonb, p_client text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest integer;
begin
  if coalesce(public.page_role(p_page), '') not in ('owner', 'editor') then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  if (select kind from public.pages where id = p_page) is distinct from 'note' then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  -- One writer at a time per note.
  select doc_version into latest from public.pages where id = p_page for update;
  select coalesce(max(s.version + jsonb_array_length(s.steps)), latest) into latest
  from public.page_steps s where s.page_id = p_page;
  if p_version <> latest then
    return jsonb_build_object('ok', false, 'reason', 'behind', 'version', latest);
  end if;
  insert into public.page_steps (page_id, version, steps, client_id) values (p_page, p_version, p_steps, p_client);
  return jsonb_build_object('ok', true, 'version', p_version + jsonb_array_length(p_steps));
end;
$$;

/**
 * Store a note's document at a version all its steps reached (0011_sharing_safety.sql), now for notes
 * only. It is also the only way a note's version of working together (doc_version) moves on
 * (pages_guard).
 */
create or replace function public.save_note_snapshot(p_page uuid, p_version integer, p_content jsonb, p_plain text, p_links uuid[] default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest integer;
  current_version integer;
begin
  if coalesce(public.page_role(p_page), '') not in ('owner', 'editor') then
    return false;
  end if;
  if (select kind from public.pages where id = p_page) is distinct from 'note' then
    return false;
  end if;
  select doc_version into current_version from public.pages where id = p_page for update;
  select coalesce(max(s.version + jsonb_array_length(s.steps)), current_version) into latest
  from public.page_steps s where s.page_id = p_page;
  if p_version < current_version or p_version > latest then
    return false;
  end if;
  -- Already stored at this version (maybe with newer changes saved outside working together).
  if p_version = current_version then
    return true;
  end if;
  -- pages_guard lets this function (and only this one) move doc_version on.
  perform set_config('blob.saving_note', 'on', true);
  update public.pages
  set content = p_content, plain_text = left(coalesce(p_plain, ''), 20000), doc_version = p_version,
      links = coalesce(p_links, links)
  where id = p_page;
  perform set_config('blob.saving_note', '', true);
  delete from public.page_steps where page_id = p_page and version + jsonb_array_length(steps) <= p_version - 400;
  return true;
end;
$$;

-- Guards ------------------------------------------------------------------------------------------

/**
 * Before a page changes (0011_sharing_safety.sql, its rule about steps now for notes only, and only
 * about the note's own steps) and, new here, for everyone signed in: a page's kind stays what it
 * is, and its revision only moves on by one. Saving builds on the revision (save_sheet, save_deck),
 * so a revision set far ahead, say to the integer maximum, would make the page impossible to save.
 * For the same reason a note's version of working together (doc_version) moves on through
 * save_note_snapshot only: the steps build on it (push_steps), so set far ahead it would keep
 * everyone from editing the note together, and a write that changed it along with the content would
 * get around the rule about steps. The app never writes it. A spreadsheet's content and its save
 * ids change through save_sheet only: a plain write (the table API) could store a workbook too big
 * for save_sheet, which nobody could save again, or make a save that landed look lost. The app
 * never writes them any other way (the importers add a spreadsheet with its content:
 * pages_add_guard). And the content of any page must be fit to store (content_problem; save_sheet
 * checks its own).
 */
create or replace function public.pages_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  changed boolean := new.content is distinct from old.content;
  problem text;
  old_root uuid;
  new_root uuid;
  old_root_owner uuid;
  new_root_owner uuid;
begin
  -- doc_version moves on through save_note_snapshot only (first, so that the rule about steps below
  -- sees it as it was).
  if me is not null and pg_trigger_depth() = 1 and current_setting('blob.saving_note', true) is distinct from 'on' then
    new.doc_version := old.doc_version;
  end if;
  -- Versions: a changed document gets a new revision. A note saved outside working together
  -- (doc_version unchanged) must already contain every step; then the step history goes. (Only
  -- notes have steps: push_steps.) The steps are the stored note's (old.id): an id the write sends
  -- is put back only further down, and naming another note's would get around this rule, or delete
  -- the steps of a note the writer can't even open.
  if changed then
    if new.rev = old.rev then
      new.rev := old.rev + 1;
    end if;
    if old.kind = 'note' and new.doc_version = old.doc_version then
      if exists (
        select 1 from public.page_steps s
        where s.page_id = old.id and s.version + jsonb_array_length(s.steps) > old.doc_version
      ) then
        raise exception 'pages: this note has newer changes from working together' using errcode = 'BL409';
      end if;
      delete from public.page_steps where page_id = old.id;
    end if;
  end if;
  -- The server itself, and pages moved by pages_keep_others (a trigger inside a delete).
  if me is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  new.id := old.id;
  new.kind := old.kind;
  if new.rev is distinct from old.rev and new.rev is distinct from old.rev + 1 then
    new.rev := old.rev + case when changed then 1 else 0 end;
  end if;
  if current_setting('blob.saving_sheet', true) is distinct from 'on' then
    new.save_ids := old.save_ids;
    if new.kind = 'sheet' and changed then
      raise exception 'pages: a spreadsheet is saved through save_sheet' using errcode = '42501';
    end if;
    if changed then
      problem := public.content_problem(new.content);
      if problem = 'invalid' then
        raise exception 'pages: this content has a number no browser can write' using errcode = '22003';
      elsif problem = 'too_big' then
        raise exception 'pages: this content is too big to store' using errcode = 'BL413';
      end if;
    end if;
  end if;
  if old.user_id <> me then
    -- Someone the page is shared with: who owns it, its subject, the owner's favourite and the
    -- trash stay as they are.
    new.user_id := old.user_id;
    new.subject_id := old.subject_id;
    new.is_favorite := old.is_favorite;
    new.trashed_at := old.trashed_at;
  end if;
  if new.parent_id is not distinct from old.parent_id then
    return new;
  end if;
  if new.parent_id is not null then
    if public.page_is_inside(new.parent_id, new.id) then
      raise exception 'pages: a page can''t go inside itself' using errcode = '42501';
    end if;
    if coalesce(public.page_role(new.parent_id), '') not in ('owner', 'editor') then
      raise exception 'pages: you can only move pages into pages you can edit' using errcode = '42501';
    end if;
  end if;
  -- Into another tree (or out to the top level): only the page's owner, and other people's pages
  -- inside stay with the tree they were shared in.
  old_root := public.page_root(old.id);
  new_root := case when new.parent_id is null then new.id else public.page_root(new.parent_id) end;
  if old_root is distinct from new_root then
    if old.user_id <> me then
      raise exception 'pages: you can only move this page inside the shared page' using errcode = '42501';
    end if;
    select user_id into old_root_owner from public.pages where id = old_root;
    new_root_owner := case when new_root = new.id then old.user_id else (select user_id from public.pages where id = new_root) end;
    if old_root_owner is distinct from new_root_owner and public.page_has_others_inside(new.id, me) then
      raise exception 'pages: other people''s pages inside stay in the shared page' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

/**
 * Before a page is added by someone signed in: it starts at the beginning (its revision, its
 * version of working together and its save ids are the server's to move on: a revision set to the
 * integer maximum could never be saved), its content must be fit to store (content_problem), and a
 * spreadsheet must be small enough to save. The importers measure a spreadsheet exactly as
 * save_sheet does before they add one (src/components/sheet/importFile.ts); here only its stored
 * form can be measured, which prints longer: up to 10,000,000 bytes, the most save_sheet stores.
 */
create or replace function public.pages_add_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  problem text;
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  new.rev := 0;
  new.doc_version := 0;
  new.save_ids := '{}';
  -- (First, so nothing that prints far longer than it was sent is printed below.)
  problem := public.content_problem(new.content);
  if problem = 'invalid' then
    raise exception 'pages: this content has a number no browser can write' using errcode = '22003';
  elsif problem = 'too_big' then
    raise exception 'pages: this content is too big to store' using errcode = 'BL413';
  end if;
  if new.kind = 'sheet' and octet_length(new.content::text) > 10000000 then
    raise exception 'pages: this spreadsheet is too big to save' using errcode = 'BL413';
  end if;
  return new;
end;
$$;

drop trigger if exists pages_add_guard on public.pages;
create trigger pages_add_guard before insert on public.pages
  for each row execute function public.pages_add_guard();
