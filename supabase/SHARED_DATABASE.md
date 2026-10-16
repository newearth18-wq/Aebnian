# Aebnian shared database

Since 2026-10-16 Aebnian uses the active Frostbound Classroom Supabase project
`zjvzsfbtwxeazwnkxdbw`, also used by Coastal Quest.

## Isolation

- Aebnian tables: `public.aeb_quiz_packs`, `public.aeb_quiz_questions`.
- Atomic teacher save: `public.aeb_save_quiz_pack`.
- Student answer check: `public.aeb_validate_published_quiz_answer`, backed by
  `aeb_private.validate_published_quiz_answer` outside the exposed API schema.
- Teachers can read and edit only their own Aebnian questions, enforced by RLS.
- Students can read published question text and choices; answer columns are private.
- Other games' tables and data are unchanged.

The initial schema applied to the hosted shared project is in `shared-aebnian.sql`.
The older files in `migrations/` document the original standalone database and
must not be applied to the shared project. The shared bootstrap SQL runs once;
subsequent changes require a separate migration.

## Configuration and accounts

`client/config.js` and `supabase-public.json` must contain the same public project
URL and publishable key. The game server uses this file directly; generic stale
`SUPABASE_URL` / `SUPABASE_KEY` deployment variables do not override it.
Never place a secret or service role key in either file.

Apps using this project's Supabase Auth share user accounts and credentials.
They still have separate browser sessions on different website origins.
Apps with their own custom account tables do not automatically share logins.

At cutover, email signup is enabled and email confirmation is required. Custom
SMTP is not configured. Supabase's default mail service limits recipients to
organization members, so general teacher signup needs custom SMTP before it
can be treated as ready. Do not disable confirmation for the shared project
without the owner's decision: that changes account verification for every app
using this Auth service.

## Deferred migration

The former Aebnian project `zcrcycwgjotvkovolznj` remains paused. Its old accounts
and quizzes have not been migrated. The owner chose to keep the old data for a
later migration rather than temporarily pause Snowbrawl to restore that project.
No old project or data was deleted, and no other project was paused.

When migration is requested, restore the original project after capacity is
available, export and back up its data, map old teacher owners to shared Auth
identities, and import quizzes into the `aeb_` tables in a transaction. Check
ownership and question counts before changing or retiring the old project.

## Verification performed

Transactional hosted database checks passed for saving a pack and questions,
teacher ownership isolation (including rejected cross-account edits), draft
privacy, hidden answer columns, and correct/wrong/cross-pack answer checks.
All verification rows were rolled back. No user passwords or accounts were
changed for these checks.
