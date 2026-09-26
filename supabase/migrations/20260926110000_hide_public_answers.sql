-- Students can read question text and choices, but not the answer column.
revoke select on public.quiz_packs, public.quiz_questions from anon;
grant select (id, title, description, is_published) on public.quiz_packs to anon;
grant select (id, pack_id, prompt, options, position) on public.quiz_questions to anon;

drop policy "Students read published question packs" on public.quiz_packs;
create policy "Students read published question packs"
  on public.quiz_packs for select to anon
  using (is_published = true);

drop policy "Students read questions in published packs" on public.quiz_questions;
create policy "Students read questions in published packs"
  on public.quiz_questions for select to anon
  using (exists (
    select 1 from public.quiz_packs p
    where p.id = quiz_questions.pack_id and p.is_published = true
  ));

create or replace function public.validate_published_quiz_answer(
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
  from public.quiz_questions q
  join public.quiz_packs p on p.id = q.pack_id
  where q.id = p_question_id
    and p.is_published = true
    and (p_set_id is null or p.id = p_set_id)
$$;

revoke all on function public.validate_published_quiz_answer(uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function public.validate_published_quiz_answer(uuid,text,uuid)
  to anon;
