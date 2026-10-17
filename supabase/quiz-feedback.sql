-- Add to the shared Aebnian schema. Answers are returned only after a valid
-- choice for a published question. The ordinary question-list API stays blind.
create or replace function aeb_private.published_quiz_feedback(
  p_question_id uuid, p_choice text, p_set_id uuid default null
) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'isCorrect', p_choice = (q.id::text || ':' || q.correct_option::text),
    'correctAnswer', q.options ->> q.correct_option,
    'explanation', coalesce(q.explanation, '')
  )
  from public.aeb_quiz_questions q
  join public.aeb_quiz_packs p on p.id = q.pack_id
  where q.id = p_question_id and p.is_published = true
    and (p_set_id is null or p.id = p_set_id)
    and exists (
      select 1 from generate_series(0, jsonb_array_length(q.options) - 1) choice_index
      where p_choice = (q.id::text || ':' || choice_index::text)
    )
$$;
revoke all on function aeb_private.published_quiz_feedback(uuid,text,uuid) from public, anon, authenticated;
grant execute on function aeb_private.published_quiz_feedback(uuid,text,uuid) to anon;

create or replace function public.aeb_published_quiz_feedback(
  p_question_id uuid, p_choice text, p_set_id uuid default null
) returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select aeb_private.published_quiz_feedback(p_question_id, p_choice, p_set_id)
$$;
revoke all on function public.aeb_published_quiz_feedback(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.aeb_published_quiz_feedback(uuid,text,uuid) to anon;
