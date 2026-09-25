# Aebnian Classroom Game

Aebnian is an original browser-based classroom hide-and-seek game. Teachers create quiz packs and host a room; students join with a link and nickname. The first release includes three original 3D maps and quiz-powered abilities.

## Local setup

Requirements: Node.js 22 or later and an existing Supabase project.

1. Copy `.env.example` to `.env` and fill in the Supabase project URL and publishable/anon key in both the `VITE_` and server variables.
2. Apply the database schema with `npx supabase db push` after linking the local project using the Supabase CLI.
3. Install packages with `npm install`.
4. Start the combined Vite and Colyseus development server with `npm run dev`.

Teachers can sign up through the teacher portal. If email confirmation is enabled in Supabase Auth, confirm the address before signing in.

## Free hosting

The included `render.yaml` describes a Render Free Docker Web Service. Connect the repository in Render, set the four Supabase environment values, and use the supplied health check. Create a Supabase Free project and apply `supabase/migrations/20260925143020_classroom_question_packs.sql` before opening a hosted classroom.

Free services can sleep, restart, or pause. A running room is temporary and a server restart ends its match. The free Render instance has limited CPU and memory; do not assume it can handle 50 simultaneous players until the planned capacity rehearsal passes on that service. Do not add a paid instance to work around a failed rehearsal without revisiting the free-hosting requirement.

## Controls

- Desktop: W/A/S/D or arrow keys to move; move the mouse to aim your facing direction.
- Mobile: drag the on-screen movement pad.
- Hiders can spend one charge to emit a decoy. Seekers can spend one charge to scan nearby.
- Correct quiz answers grant one charge, up to two charges.

Question packs are protected by Supabase Row Level Security and are visible only to their owning teacher. Room roles, movement, quiz answers, and round timing are managed by the Colyseus server.
