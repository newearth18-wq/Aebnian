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

Email signup is enabled and email confirmation is required. On 2026-10-16 the
owner configured Brevo custom SMTP in the shared project's Auth dashboard:
`smtp-relay.brevo.com`, port `587`, sender name `Classroom Games`. A fresh page
load confirmed that the settings and an encrypted password were saved. The
SMTP key stays in Supabase and must never be copied into this repository.
SMTP delivery was verified with an owner-authorized password recovery email
on 2026-10-16 at 22:30 Asia/Bangkok: Auth recorded `recovery_sent_at`, and Brevo
recorded both Sent and Delivered for the message. The first signup test
returned `user_repeated_signup` for an already confirmed shared account, so
no verification email was dispatched. That user should sign in with their
existing credentials; repeated signup does not reset their password.
The verified sender currently uses
a Gmail address; Brevo may replace its sender domain for delivery. A custom
authenticated sender domain can be configured later for consistent branding.

Do not disable confirmation for the shared project without the owner's
decision: that changes account verification for every app using this Auth
service. The owner explicitly chose SMTP with email verification.

Password recovery is available at `/reset-password` from both teacher login
screens. Its production redirect URL is allowlisted in Supabase Auth. Recovery
uses an isolated in-memory Auth client, validates the recovery session before
showing the password form, and never persists its tokens into the game session.
The owner confirmed successful sign-in with their existing shared account.
The live request page and expired-link fallback were checked in the browser;
14 automated auth/recovery checks passed. The recovery email test did not
change the owner's password. Saving a real new password remains a user action.

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
