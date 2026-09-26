-- Public question sets remain drafts until a teacher publishes them.
alter table public.quiz_packs
  add column if not exists is_published boolean not null default false;

revoke insert, update, delete, truncate, references, trigger
  on public.quiz_packs, public.quiz_questions from anon;
revoke truncate, references, trigger
  on public.quiz_packs, public.quiz_questions from authenticated;
grant select on public.quiz_packs, public.quiz_questions to anon, authenticated;

create policy "Students read published question packs"
  on public.quiz_packs for select to anon, authenticated
  using (is_published = true);

create policy "Students read questions in published packs"
  on public.quiz_questions for select to anon, authenticated
  using (exists (
    select 1 from public.quiz_packs p
    where p.id = quiz_questions.pack_id and p.is_published = true
  ));

-- Save the pack and all its questions in one transaction.
create or replace function public.save_quiz_pack(
  p_id uuid,
  p_title text,
  p_description text,
  p_published boolean,
  p_questions jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
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
    insert into public.quiz_packs (owner_id, title, description, is_published)
    values (auth.uid(), trim(p_title), nullif(trim(p_description), ''), coalesce(p_published, false))
    returning id into v_id;
  else
    update public.quiz_packs
       set title = trim(p_title),
           description = nullif(trim(p_description), ''),
           is_published = coalesce(p_published, false),
           updated_at = now()
     where id = p_id and owner_id = auth.uid()
    returning id into v_id;
    if v_id is null then
      raise exception 'Question set not found or access denied';
    end if;
    delete from public.quiz_questions where pack_id = v_id;
  end if;

  for v_question in select value from jsonb_array_elements(p_questions) loop
    insert into public.quiz_questions
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

revoke all on function public.save_quiz_pack(uuid,text,text,boolean,jsonb) from public, anon;
grant execute on function public.save_quiz_pack(uuid,text,text,boolean,jsonb) to authenticated;
