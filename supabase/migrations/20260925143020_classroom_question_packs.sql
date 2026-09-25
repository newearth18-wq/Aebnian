create table if not exists public.quiz_packs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.quiz_packs (id) on delete cascade,
  prompt text not null check (char_length(btrim(prompt)) between 1 and 1000),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_option smallint not null check (correct_option between 0 and 3),
  explanation text,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (pack_id, position)
);

create index if not exists quiz_packs_owner_updated_idx on public.quiz_packs (owner_id, updated_at desc);
create index if not exists quiz_questions_pack_position_idx on public.quiz_questions (pack_id, position);

create or replace function public.touch_quiz_pack_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.quiz_packs set updated_at = now() where id = coalesce(new.pack_id, old.pack_id);
  return null;
end;
$$;

create trigger quiz_questions_touch_parent
after insert or update or delete on public.quiz_questions
for each row execute function public.touch_quiz_pack_updated_at();

alter table public.quiz_packs enable row level security;
alter table public.quiz_questions enable row level security;

grant select, insert, update, delete on public.quiz_packs to authenticated;
grant select, insert, update, delete on public.quiz_questions to authenticated;

create policy "Teachers manage their own question packs"
on public.quiz_packs for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Teachers manage questions in their own packs"
on public.quiz_questions for all to authenticated
using (exists (
  select 1 from public.quiz_packs p
  where p.id = quiz_questions.pack_id and p.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.quiz_packs p
  where p.id = quiz_questions.pack_id and p.owner_id = (select auth.uid())
));
