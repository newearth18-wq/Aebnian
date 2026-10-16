create table if not exists public.aeb_quiz_packs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aeb_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.aeb_quiz_packs (id) on delete cascade,
  prompt text not null check (char_length(btrim(prompt)) between 1 and 1000),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_option smallint not null check (correct_option between 0 and 3),
  explanation text,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (pack_id, position)
);

create index if not exists aeb_quiz_packs_owner_updated_idx on public.aeb_quiz_packs (owner_id, updated_at desc);
create index if not exists aeb_quiz_questions_pack_position_idx on public.aeb_quiz_questions (pack_id, position);

create or replace function public.aeb_touch_quiz_pack_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.aeb_quiz_packs set updated_at = now() where id = coalesce(new.pack_id, old.pack_id);
  return null;
end;
$$;

create trigger aeb_quiz_questions_touch_parent
after insert or update or delete on public.aeb_quiz_questions
for each row execute function public.aeb_touch_quiz_pack_updated_at();

alter table public.aeb_quiz_packs enable row level security;
alter table public.aeb_quiz_questions enable row level security;

grant select, insert, update, delete on public.aeb_quiz_packs to authenticated;
grant select, insert, update, delete on public.aeb_quiz_questions to authenticated;

create policy "Teachers manage their own question packs"
on public.aeb_quiz_packs for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Teachers manage questions in their own packs"
on public.aeb_quiz_questions for all to authenticated
using (exists (
  select 1 from public.aeb_quiz_packs p
  where p.id = aeb_quiz_questions.pack_id and p.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.aeb_quiz_packs p
  where p.id = aeb_quiz_questions.pack_id and p.owner_id = (select auth.uid())
));

-- Public question sets remain drafts until a teacher publishes them.
alter table public.aeb_quiz_packs
  add column if not exists is_published boolean not null default false;

revoke insert, update, delete, truncate, references, trigger
  on public.aeb_quiz_packs, public.aeb_quiz_questions from anon;
revoke truncate, references, trigger
  on public.aeb_quiz_packs, public.aeb_quiz_questions from authenticated;
grant select on public.aeb_quiz_packs, public.aeb_quiz_questions to anon, authenticated;

create policy "Students read published question packs"
  on public.aeb_quiz_packs for select to anon, authenticated
  using (is_published = true);

create policy "Students read questions in published packs"
  on public.aeb_quiz_questions for select to anon, authenticated
  using (exists (
    select 1 from public.aeb_quiz_packs p
    where p.id = aeb_quiz_questions.pack_id and p.is_published = true
  ));

-- Save the pack and all its questions in one transaction.
create or replace function public.aeb_save_quiz_pack(
  p_id uuid,
  p_title text,
  p_description text,
  p_published boolean,
  p_questions jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_question jsonb;
  v_options jsonb;
  v_position integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in before editing question sets';
  end if;
  if nullif(trim(p_title), '') is null or length(p_title) > 120 then
    raise exception 'A title of at most 120 characters is required';
  end if;
  if jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'Questions must be an array';
  end if;
  if jsonb_array_length(p_questions) < 1
     or jsonb_array_length(p_questions) > 100 then
    raise exception 'Question sets require 1 to 100 questions';
  end if;

  for v_question in select value from jsonb_array_elements(p_questions) loop
    v_options := v_question -> 'options';
    if jsonb_typeof(v_options) is distinct from 'array' then
      raise exception 'Every question needs four choices';
    end if;
    if nullif(trim(v_question ->> 'prompt'), '') is null
       or jsonb_array_length(v_options) <> 4
       or exists (
         select 1 from jsonb_array_elements_text(v_options) as choice(value)
         where nullif(trim(choice.value), '') is null
       )
       or (v_question ->> 'correct_option')::integer not between 0 and 3 then
      raise exception 'Every question needs text, four choices, and a valid answer';
    end if;
  end loop;

  if p_id is null then
    insert into public.aeb_quiz_packs (owner_id, title, description, is_published)
    values (auth.uid(), trim(p_title), nullif(trim(p_description), ''), coalesce(p_published, false))
    returning id into v_id;
  else
    update public.aeb_quiz_packs
       set title = trim(p_title),
           description = nullif(trim(p_description), ''),
           is_published = coalesce(p_published, false),
           updated_at = now()
     where id = p_id and owner_id = auth.uid()
    returning id into v_id;
    if v_id is null then
      raise exception 'Question set not found or access denied';
    end if;
    delete from public.aeb_quiz_questions where pack_id = v_id;
  end if;

  for v_question in select value from jsonb_array_elements(p_questions) loop
    insert into public.aeb_quiz_questions
      (pack_id, prompt, options, correct_option, explanation, position)
    values
      (v_id, trim(v_question ->> 'prompt'), v_question -> 'options',
       (v_question ->> 'correct_option')::smallint,
       nullif(trim(v_question ->> 'explanation'), ''), v_position);
    v_position := v_position + 1;
  end loop;
  return v_id;
end;
$$;

revoke all on function public.aeb_save_quiz_pack(uuid,text,text,boolean,jsonb) from public, anon;
grant execute on function public.aeb_save_quiz_pack(uuid,text,text,boolean,jsonb) to authenticated;

-- Students can read question text and choices, but not the answer column.
revoke select on public.aeb_quiz_packs, public.aeb_quiz_questions from anon;
grant select (id, title, description, is_published) on public.aeb_quiz_packs to anon;
grant select (id, pack_id, prompt, options, position) on public.aeb_quiz_questions to anon;

drop policy "Students read published question packs" on public.aeb_quiz_packs;
create policy "Students read published question packs"
  on public.aeb_quiz_packs for select to anon
  using (is_published = true);

drop policy "Students read questions in published packs" on public.aeb_quiz_questions;
create policy "Students read questions in published packs"
  on public.aeb_quiz_questions for select to anon
  using (exists (
    select 1 from public.aeb_quiz_packs p
    where p.id = aeb_quiz_questions.pack_id and p.is_published = true
  ));

-- Answer validation is the only elevated operation. Its implementation stays
-- outside the exposed API schema and reads only published Aebnian questions.
create schema if not exists aeb_private;
revoke all on schema aeb_private from public, anon, authenticated;
grant usage on schema aeb_private to anon;

create or replace function aeb_private.validate_published_quiz_answer(
  p_question_id uuid,
  p_choice text,
  p_set_id uuid default null
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_choice = (q.id::text || ':' || q.correct_option::text)
  from public.aeb_quiz_questions q
  join public.aeb_quiz_packs p on p.id = q.pack_id
  where q.id = p_question_id
    and p.is_published = true
    and (p_set_id is null or p.id = p_set_id)
$$;

revoke all on function aeb_private.validate_published_quiz_answer(uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function aeb_private.validate_published_quiz_answer(uuid,text,uuid)
  to anon;

create or replace function public.aeb_validate_published_quiz_answer(
  p_question_id uuid,
  p_choice text,
  p_set_id uuid default null
) returns boolean
language sql stable security invoker set search_path = ''
as $$
  select aeb_private.validate_published_quiz_answer(p_question_id, p_choice, p_set_id)
$$;
revoke all on function public.aeb_validate_published_quiz_answer(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.aeb_validate_published_quiz_answer(uuid,text,uuid) to anon;
revoke all on function public.aeb_touch_quiz_pack_updated_at() from public, anon, authenticated;
revoke all on public.aeb_quiz_packs, public.aeb_quiz_questions from public;
