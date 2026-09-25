# Classroom Hide-and-Seek Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shareable, browser-based 3D classroom hide-and-seek game for up to 50 players, with teacher-managed quiz packs, three selectable maps, and quiz-powered abilities.

**Architecture:** A single Vite application serves the React/Three.js client and a Colyseus authoritative room server from one origin. Supabase Auth and Postgres store teacher accounts and question packs; Row Level Security restricts packs to their owner. Railway runs the persistent Node service that serves the game and accepts WebSocket connections.

**Tech Stack:** React, TypeScript, Vite, Three.js, Colyseus 0.18+ with its Vite plugin and fixed-timestep netcode, Supabase Auth/Postgres, Vitest, `@colyseus/testing`, pgTAP, Docker, and Railway.

**Spec:** `docs/superpowers/specs/2026-09-25-classroom-hide-and-seek-design.md`

## Global Constraints

- One classroom room supports up to 50 players; at least 3 players are required to start.
- Students join by link or QR with a nickname and do not need an account.
- Teachers use an account; saved quiz packs belong to that teacher and can be reused.
- The first round question appears at round start; another appears every 60 seconds with a 15-second answer window.
- The round timer and player movement continue while a question is displayed.
- A correct answer grants one charge, with at most 2 stored charges; a captured hider becomes a seeker.
- Teachers choose one of 3 original maps and set a 1–15 minute round, defaulting to 5 minutes.
- Questions are shuffled without repeats until the pack is exhausted, then shuffled again; hiders win if any remain uncaught when time expires, and seekers win if all hiders are caught first.
- A disconnected student can return to the same room for 3 minutes using the same nickname and browser-stored reconnect token.
- If the teacher disconnects during active play, pause the match until that teacher returns and resumes or ends it.
- Build original scenes and character graphics for Aebnian; do not reuse Meccha Chameleon artwork or maps.
- The game must support touch controls on mobile and keyboard/mouse controls on computer.

**WebGL compatibility constraint:** Three.js `WebGLRenderer` requires WebGL 2. Detect unsupported browsers before room entry and show a clear compatibility message. The official renderer documentation states that WebGL 1 has not been supported since r163. [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)

## Review Focus

1. **Cross-teacher pack access:** a signed-in teacher cannot read, edit, delete, or start a room with another teacher’s pack. Pin this in the Supabase RLS tests in Task 2 and the server authorization test in Task 4.
2. **Room boundary inputs:** reject a 51st player, a new join after a round starts, and a start request with fewer than 3 players. Pin these in Task 4’s room tests.
3. **Movement and capture abuse:** clamp malformed movement inputs and decide captures on the server; a client cannot set its own role or teleport to tag someone. Pin these in Task 5’s room simulation tests.
4. **Quiz timer boundaries:** an answer at the 15-second deadline is rejected, the round clock continues during prompts, and the match ends at zero even if a prompt is open. Pin these in Task 7’s scheduler checks.
5. **Reconnect identity:** only the browser-stored token can restore a disconnected player, within 3 minutes; expired or copied nicknames do not take over that slot. Pin these in Task 8’s reconnect tests.

---

## File Map

- `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`: application dependencies, scripts, shared TypeScript settings, and the Colyseus/Vite integration.
- `src/main.tsx`, `src/App.tsx`, `src/styles.css`: React entry point and top-level screens.
- `src/shared/protocol.ts`, `src/shared/movement.ts`, `src/shared/types.ts`: message names, map/role types, and the deterministic movement function shared by browser and room server.
- `src/shared/mapDefinitions.ts`: authoritative bounds, obstacle rectangles, and spawn points shared by renderer and server.
- `src/client/auth/`: teacher sign-in and Supabase browser client.
- `src/client/packs/`: question-pack library, editor, and validation.
- `src/client/lobby/`: host setup, join flow, QR link, and waiting room.
- `src/client/game/`: HUD, question overlay, ability buttons, results, and room state subscription.
- `src/client/scene/`: Three.js renderer, camera/input controllers, avatars, camouflage picker, and three map constructors.
- `src/server/index.ts`: Colyseus server entry and health endpoint.
- `src/server/auth/teacherAccess.ts`: verify the teacher token and load only that teacher’s selected pack.
- `src/server/rooms/ClassroomRoom.ts`, `src/server/rooms/ClassroomState.ts`: room lifecycle, synchronized public state, and player state; Task 1 creates a minimal room and Task 4 extends it.
- `src/server/game/`: role assignment, round clock, captures, quiz scheduler, and server-validated powers.
- `supabase/migrations/`: timestamped migrations for question packs and questions, created through the Supabase CLI.
- `supabase/tests/question_pack_rls.test.sql`: database-level ownership tests.
- `src/**/*.test.ts`, `src/**/*.test.tsx`: client, shared-logic, and room tests.
- `.env.example`, `Dockerfile`, `.dockerignore`, `README.md`: local setup, production build, hosting configuration, and operator instructions.

## Interfaces Shared Between Tasks

Define these in `src/shared/types.ts` and `src/shared/protocol.ts` before the client and room tasks depend on them:

```ts
export type MapId = "lab" | "library" | "garden";
export type PlayerRole = "hider" | "seeker";
export type MatchPhase = "lobby" | "active" | "finished";
export type MatchWinner = "hiders" | "seekers" | "draw";

export interface MoveInput {
  moveX: number;
  moveZ: number;
  yaw: number;
}

export interface PlayerPose {
  x: number;
  z: number;
  yaw: number;
}

export interface MapDefinition {
  id: MapId;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  obstacles: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
  spawnPoints: PlayerPose[];
}

export interface PlayerView extends PlayerPose {
  id: string;
  nickname: string;
  role: PlayerRole;
  camouflageHex: string;
  charges: number;
  knowledgeScore: number;
  connected: boolean;
}

export interface RoomSetup {
  packId: string;
  mapId: MapId;
  durationMinutes: number;
}

export interface QuizPrompt {
  id: string;
  text: string;
  options: string[];
  explanation: string | null;
}

export interface PublicRoomState {
  phase: MatchPhase;
  mapId: MapId;
  durationMinutes: number;
  remainingSeconds: number;
  players: PlayerView[];
  quizPrompt: QuizPrompt | null;
  winner: MatchWinner | null;
}

export interface QuizAnswerInput {
  questionId: string;
  optionIndex: number;
}
```

`QuizPrompt` deliberately excludes the correct option. Keep answer keys in server-only room data. `MoveInput` is the only client movement payload; implement `applyMovement(position: PlayerPose, input: MoveInput, dtSeconds: number, map: MapDefinition): PlayerPose` in `src/shared/movement.ts`. The shared map definitions are the source for both rendering and server collision/spawn rules so a player cannot walk through cover or outside the arena. The room server owns world coordinates, role, charges, scores, answer keys, and the round clock. `PublicRoomState` never includes teacher credentials, correct options, or reconnect tokens.

## Tasks

### Task 1: Bootstrap the React, Vite, and Colyseus application

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/server/index.ts`, `src/server/health.ts`, `src/server/rooms/ClassroomRoom.ts`, `src/shared/types.ts`, `src/shared/protocol.ts`
- Test: `src/App.test.tsx`, `src/server/health.test.ts`

**Interfaces:**
- Consumes: none; repository contains the approved design spec only.
- Produces: Vite dev server, React shell, Colyseus Vite server entry, a minimal registered `classroom` room, `/health` response `{ status: "ok" }`, and shared type modules.

- [ ] **Step 1: Write the failing app-shell test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("shows the Aebnian title", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Aebnian" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing app fails**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL because `src/App.tsx` does not yet export the application component.

- [ ] **Step 3: Create the React shell and shared type modules**

Create `src/main.tsx`, `src/App.tsx`, `src/styles.css`, and `src/shared/types.ts` / `protocol.ts`. Render the heading `Aebnian` and an initial landing screen without game flows yet.

- [ ] **Step 4: Register the minimal Colyseus room and health route**

Configure the React Vite plugin followed by `colyseus({ serverEntry: "/src/server/index.ts", port: Number(process.env.PORT ?? 2567), serveClient: true })`. Export `server` from `src/server/index.ts`, register `classroom` using the minimal `src/server/rooms/ClassroomRoom.ts`, and add `GET /health` using the Colyseus server’s Express hook. Set the root npm scripts to `dev`, `build` (`vite build --app`), `start` (`node dist/server/server.mjs`), `typecheck`, and `test`.

- [ ] **Step 5: Run shell tests, typecheck, and production build**

Run: `npm test -- --run src/App.test.tsx src/server/health.test.ts`
Expected: PASS.
Run: `npm run typecheck && npm run build`
Expected: both commands exit 0; the build emits `dist/client/` and `dist/server/server.mjs`.

- [ ] **Step 6: Commit the application shell**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore src
git commit -m "chore: bootstrap classroom game app"
```

### Task 2: Add Supabase teacher accounts and owned question-pack tables

**Files:**
- Create: `supabase/config.toml`, `.env.example`
- Create: timestamped `supabase/migrations/` migration named `create_quiz_library`, generated with the Supabase CLI
- Create: `supabase/tests/question_pack_rls.test.sql`
- Create: `src/client/auth/supabase.ts`, `src/client/packs/types.ts`, `src/client/packs/validateQuestion.ts`, `src/client/packs/validateQuestion.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 shared TypeScript settings and test runner.
- Produces: `QuizPack`, `QuizQuestion`, `validateQuestion(input)`, and owner-scoped `quiz_packs` / `quiz_questions` tables.

- [ ] **Step 1: Write question validation cases**

```ts
import { describe, expect, it } from "vitest";
import { validateQuestion } from "./validateQuestion";

describe("validateQuestion", () => {
  it("rejects a correct option outside the option list", () => {
    expect(validateQuestion({
      text: "2 + 2 = ?",
      options: ["3", "4"],
      correctOption: 2,
      explanation: null,
    })).toEqual({ valid: false, reason: "correct-option-out-of-range" });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- --run src/client/packs/validateQuestion.test.ts`
Expected: FAIL because `validateQuestion` is not implemented.

- [ ] **Step 3: Generate and write the database migration**

Run `supabase --help`, then `supabase migration --help`; use the installed CLI’s documented syntax to create a migration named `create_quiz_library`. Create `quiz_packs(id, owner_id, title, created_at, updated_at)` and `quiz_questions(id, pack_id, position, text, options, correct_option, explanation)` with foreign keys, nonempty text constraints, 2–6 choices, and an in-range `correct_option` constraint. Enable RLS on both tables. Add owner-only SELECT/INSERT/UPDATE/DELETE policies; for question rows, derive ownership through `quiz_packs`. Include explicit grants only for the authenticated operations used by the editor, because new Data API exposure defaults changed in 2026.

- [ ] **Step 4: Add concrete database ownership assertions**

In `supabase/tests/question_pack_rls.test.sql`, create two fixture teachers and one pack per teacher. Under `authenticated` with the JWT subject set to teacher A, assert the visible pack count is 1 and it is A’s pack. Switch the subject to teacher B; assert A’s pack cannot be selected, updated, or deleted, and B cannot insert a question whose `pack_id` points to A’s pack. Use pgTAP assertions such as `is((select count(*)::int from public.quiz_packs), 1, 'teacher sees only own pack')` and `throws_ok(...)` for a rejected cross-owner write. Follow the installed Supabase CLI’s `supabase test db --help` before running the SQL suite.

- [ ] **Step 5: Implement the question validator, apply the migration, and commit**

`validateQuestion` accepts 2–6 options, nonblank question text, an integer `correctOption` in range, and an optional explanation. Add `owner_id = auth.uid()` to every pack policy and an `exists` ownership predicate for question policies. Store only the publishable Supabase key in browser configuration; never include a Supabase secret/service-role key in the client bundle.

Run: `npm test -- --run src/client/packs/validateQuestion.test.ts`
Expected: PASS. Apply the migration to the local Supabase database and run the SQL suite using the command confirmed from `supabase test db --help`; expected: all pgTAP assertions pass.

```bash
git add package.json package-lock.json .env.example supabase src/client/auth src/client/packs
git commit -m "feat: add teacher quiz storage with row security"
```

### Task 3: Build teacher sign-in and question-pack management

**Files:**
- Create: `src/client/auth/TeacherAuth.tsx`, `src/client/auth/AuthGate.tsx`
- Create: `src/client/packs/packApi.ts`, `src/client/packs/QuestionPackLibrary.tsx`, `src/client/packs/QuestionPackEditor.tsx`, `src/client/packs/QuestionEditor.tsx`
- Test: `src/client/auth/AuthGate.test.tsx`, `src/client/packs/packApi.test.ts`, `src/client/packs/QuestionPackEditor.test.tsx`
- Modify: `package.json`, `package-lock.json`, `src/shared/mapDefinitions.ts`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: Task 2 Supabase client, `QuizPack`, `QuizQuestion`, and `validateQuestion`.
- Produces: `listPacks()`, `createPack(title)`, `savePack(packId, questions)`, `duplicatePack(packId)`, and `deletePack(packId)`; teacher sign-in state for the lobby.

- [ ] **Step 1: Test pack validation and ownership-aware API calls with a mocked Supabase client**

Assert that blank titles are rejected; a valid pack saves its ordered questions; duplicate creates a new ID; delete targets only the selected pack ID. Keep the correct-option index in teacher-only pack data.

- [ ] **Step 2: Run pack API/editor tests and confirm they fail**

Run: `npm test -- --run src/client/packs/packApi.test.ts src/client/packs/QuestionPackEditor.test.tsx`
Expected: FAIL because pack API and editor modules are missing.

- [ ] **Step 3: Implement teacher sign-in and the pack library list**

Use Supabase Auth email/password for teachers. Render the saved-pack list after sign-in with loading, empty, and error states. Add create and open-existing-pack actions. Keep anonymous student room links accessible without passing through the teacher sign-in gate.

- [ ] **Step 4: Implement pack editing and library actions**

Add title and ordered question editing with 2–6 answer options, exactly one correct option, and optional explanation. Disable Save until all questions pass `validateQuestion`. Wire duplicate to create a new pack ID and delete to the selected pack ID only.

- [ ] **Step 5: Run account and pack tests**

Run: `npm test -- --run src/client/auth/AuthGate.test.tsx src/client/packs/packApi.test.ts src/client/packs/QuestionPackEditor.test.tsx`
Expected: PASS; an unauthenticated host is prompted to sign in, an anonymous student can open a join link, and an authenticated teacher sees only their own packs.

- [ ] **Step 6: Commit the teacher library**

```bash
git add package.json package-lock.json src/App.tsx src/styles.css src/client/auth src/client/packs
git commit -m "feat: add teacher question pack editor"
```

### Task 4: Implement teacher room setup, student join, and lobby boundaries

**Files:**
- Create: `src/client/lobby/HostSetup.tsx`, `src/client/lobby/StudentJoin.tsx`, `src/client/lobby/RoomLobby.tsx`, `src/client/lobby/roomLinks.ts`, `src/client/lobby/roomClient.ts`
- Create: `src/server/auth/teacherAccess.ts`, `src/server/rooms/ClassroomState.ts`
- Test: `src/server/rooms/ClassroomRoom.test.ts`, `src/client/lobby/roomLinks.test.ts`
- Modify: `package.json`, `package-lock.json`, `src/server/index.ts`, `src/shared/protocol.ts`, `src/App.tsx`

**Interfaces:**
- Consumes: Task 1 Colyseus server and Task 3 teacher session/pack IDs.
- Produces: teacher `createRoom({ packId, mapId, durationMinutes })`, student `joinRoom({ roomId, nickname })`, a room URL, and teacher-only start/pause/resume/end commands.

- [ ] **Step 1: Write the room-boundary tests**

Use `@colyseus/testing` to assert that a room allows 50 clients, rejects the 51st, refuses a new player after the phase becomes `active`, rejects `start` with 2 players while accepting it with 3, and rejects a room request when the selected quiz pack belongs to another teacher.

- [ ] **Step 2: Run the room tests and confirm they fail**

Run: `npm test -- --run src/server/rooms/ClassroomRoom.test.ts`
Expected: FAIL because the minimal room does not yet enforce the capacity, phase, start-count, or teacher-pack ownership rules.

- [ ] **Step 3: Implement host setup and teacher pack authorization**

The host chooses a saved pack, one of the three maps, and a round duration from 1–15 minutes (default 5). On room creation, validate the teacher’s Supabase access token with `auth.getUser(token)`, then fetch the selected pack through a Supabase client carrying that user token so RLS applies. Reject packs not owned by that teacher. Create the room with `maxClients = 50`, `mapId`, and the validated duration.

- [ ] **Step 4: Implement student join and host-only room controls**

Students enter with a nickname; reject blank or duplicate active nicknames. Generate a share link containing the room ID and display its QR code. Only the room’s authenticated teacher may start, pause, resume, or end the room. Keep a visible player count and prevent Start until 3 players have joined.

- [ ] **Step 5: Run lobby tests**

Run: `npm test -- --run src/server/rooms/ClassroomRoom.test.ts src/client/lobby/roomLinks.test.ts`
Expected: PASS for the 3-player minimum, 50-player maximum, no late joins, room URL encoding, and host-only controls.

- [ ] **Step 6: Commit the lobby slice**

```bash
git add package.json package-lock.json src/client/lobby src/server/auth src/server/rooms src/server/index.ts src/shared/protocol.ts src/App.tsx
git commit -m "feat: add teacher lobby and classroom join links"
```

### Task 5: Add authoritative movement, role assignment, and capture conversion

**Files:**
- Create: `src/shared/movement.ts`, `src/shared/movement.test.ts`, `src/shared/mapDefinitions.ts`
- Create: `src/server/game/roles.ts`, `src/server/game/roles.test.ts`, `src/server/game/capture.ts`, `src/server/game/capture.test.ts`
- Modify: `src/shared/protocol.ts`, `src/server/rooms/ClassroomState.ts`, `src/server/rooms/ClassroomRoom.ts`
- Test: `src/server/rooms/ClassroomMovement.test.ts`

**Interfaces:**
- Consumes: Task 4 room phases and player records.
- Produces: shared deterministic `applyMovement(position, input, dtSeconds, map)`, `getSeekerCount(playerCount)`, and server-side `tagNearbyPlayers()`.

- [ ] **Step 1: Write role and movement tests**

Assert `getSeekerCount(3) === 1`, `getSeekerCount(50) === 5`, invalid/non-finite axes are clamped to `[-1, 1]`, movement remains inside map bounds and cannot pass through an obstacle rectangle, and only the server’s tag-radius check changes a hider to a seeker.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- --run src/shared/movement.test.ts src/server/game/roles.test.ts src/server/game/capture.test.ts`
Expected: FAIL because the movement and role functions do not exist.

- [ ] **Step 3: Implement movement sanitizing and role assignment**

Implement `applyMovement(position, input, dtSeconds, map)` and `getSeekerCount(playerCount) = max(1, ceil(playerCount / 10))`; assign that many random seekers when the teacher starts. Clamp non-finite axes to zero, clamp valid axes to `[-1, 1]`, normalize diagonal movement, keep poses inside map bounds, and resolve obstacle collisions with axis-separated movement.

- [ ] **Step 4: Wire fixed-timestep movement and server-side capture**

Use Colyseus 0.18 `defineInput()` and `setFixedTimestep(step, 30)` to consume `MoveInput`. Do not accept client world coordinates or role changes. Check seeker/hider contact on the room server and convert every tagged hider to a seeker immediately.

- [ ] **Step 5: Run movement and room tests**

Run: `npm test -- --run src/shared/movement.test.ts src/server/game/roles.test.ts src/server/game/capture.test.ts src/server/rooms/ClassroomMovement.test.ts`
Expected: PASS, including a malicious coordinate payload that cannot teleport or change a player’s role.

- [ ] **Step 6: Commit the authoritative movement slice**

```bash
git add src/shared src/server/game/roles.ts src/server/game/roles.test.ts src/server/game/capture.ts src/server/game/capture.test.ts src/server/rooms
git commit -m "feat: add authoritative player movement and tagging"
```

### Task 6: Create the three mobile-friendly 3D maps and controls

**Files:**
- Create: `src/client/scene/createRenderer.ts`, `src/client/scene/mapRegistry.ts`, `src/client/scene/PlayerAvatar.ts`, `src/client/scene/CamouflagePicker.tsx`
- Create: `src/client/scene/maps/createLabMap.ts`, `src/client/scene/maps/createLibraryMap.ts`, `src/client/scene/maps/createGardenMap.ts`
- Create: `src/client/scene/controls/KeyboardControls.ts`, `src/client/scene/controls/TouchControls.tsx`
- Create: `src/client/game/GameCanvas.tsx`, `src/client/scene/mapRegistry.test.ts`, `src/client/scene/webglSupport.test.ts`
- Modify: `package.json`, `package-lock.json`, `src/shared/mapDefinitions.ts`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: Task 4 `mapId` and Task 5 synchronized player state/movement input.
- Produces: `createMap(mapId, scene)`, a third-person game view, touch joystick/camera drag on mobile, WASD/mouse on computer, and a WebGL 2 compatibility screen.

- [ ] **Step 1: Write map registry and WebGL fallback tests**

Assert each `MapId` resolves to one map constructor and an unsupported renderer result displays a compatibility message before attempting room entry.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `npm test -- --run src/client/scene/mapRegistry.test.ts src/client/scene/webglSupport.test.ts`
Expected: FAIL because the map registry and capability guard are missing.

- [ ] **Step 3: Build shared renderer and map selection registry**

Initialize Three.js only after a WebGL 2 capability check. Add a registry that maps each `MapId` to a constructor, with a clear fallback screen if WebGL 2 is unavailable.

- [ ] **Step 4: Create the three original low-poly maps**

Create the science lab, library, and school garden in separate constructors using simple original Three.js geometry and solid material colors. Add each map’s distinct bounds, obstacle rectangles, and valid spawn positions to `src/shared/mapDefinitions.ts`; render obstacles from the same data the server uses for collision. Do not reuse artwork or layouts from Meccha Chameleon.

- [ ] **Step 5: Add avatars, camouflage, and responsive controls**

Render players as low-poly chameleons from synchronized room state; interpolate remote-player poses between server updates. Hiders can select paint mode and tap/click a surface to copy its material color; apply that color to their avatar. Add a third-person camera, mobile virtual joystick plus drag-to-look, and desktop WASD plus mouse drag. Send only normalized movement input to the server, never client-authored world positions. Cap device pixel ratio and reduce shadow/detail settings on lower-power devices.

- [ ] **Step 6: Run scene tests and build the client**

Run: `npm test -- --run src/client/scene/mapRegistry.test.ts src/client/scene/webglSupport.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: PASS with all three map constructors included in the client bundle.

- [ ] **Step 7: Commit maps and controls**

```bash
git add package.json package-lock.json src/client/scene src/client/game/GameCanvas.tsx src/App.tsx src/styles.css
git commit -m "feat: add three classroom maps and responsive controls"
```

### Task 7: Add continuous quiz prompts, knowledge scoring, and abilities

**Files:**
- Create: `src/server/game/quizScheduler.ts`, `src/server/game/quizScheduler.test.ts`, `src/server/game/abilities.ts`, `src/server/game/abilities.test.ts`
- Create: `src/client/game/QuizPanel.tsx`, `src/client/game/PowerControls.tsx`, `src/client/game/GameHud.tsx`
- Modify: `src/server/rooms/ClassroomRoom.ts`, `src/server/rooms/ClassroomState.ts`, `src/shared/protocol.ts`, `src/client/game/GameCanvas.tsx`

**Interfaces:**
- Consumes: Task 2 selected pack, Task 5 room clock/role/player state, and Task 6 scene.
- Produces: `startQuestion()`, `submitAnswer(client, input)`, `closeQuestion()`, `useAbility(client)`, public `QuizPrompt`, separate knowledge score, private server answer key, and winner evaluation.

- [ ] **Step 1: Write scheduler and ability boundary tests**

Assert a prompt appears at time zero and every 60 seconds; question order does not repeat until the selected pack has been exhausted; the round clock decreases while a prompt is open; an answer at or after 15 seconds is rejected; one correct answer grants one charge; charges cap at 2; a hider uses a decoy and a seeker uses a nearby reveal pulse; the round ends at zero even if a prompt is open; hiders win if any remain at timeout and seekers win if none remain.

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `npm test -- --run src/server/game/quizScheduler.test.ts src/server/game/abilities.test.ts`
Expected: FAIL because the scheduler and ability engine are missing.

- [ ] **Step 3: Implement quiz scheduling and public prompt state**

Keep the correct-option index in server-only room data. Shuffle selected-pack question order without repeats; when all questions have been used, reshuffle and repeat. Show the first prompt at round start and schedule the next every 60 seconds. Broadcast only question text/options at the start of each 15-second answer window. The fixed round clock continues during prompts; prioritize round end over opening another prompt at the same timestamp and cancel any open prompt if the round ends.

- [ ] **Step 4: Implement answer validation and knowledge scoring**

Accept at most one answer per player and validate `questionId`, option bounds, and the 15-second deadline using server time; answers received at or after the deadline are rejected. On question close, broadcast the correct answer and explanation, increment each correct player’s `knowledgeScore`, and grant one charge up to the 2-charge cap.

- [ ] **Step 5: Implement the HUD and temporary role-specific powers**

Keep movement controls active under a compact quiz panel. Add a decoy for hiders and a brief nearby reveal pulse for seekers. Each use consumes one charge; only the room server validates role, charge count, and effect target. Show each player their own answer feedback and charge count.

- [ ] **Step 6: Run quiz and ability tests, then commit**

Run: `npm test -- --run src/server/game/quizScheduler.test.ts src/server/game/abilities.test.ts`
Expected: PASS, including the 15-second deadline and round-end-during-question cases.

```bash
git add src/server/game src/server/rooms src/shared/protocol.ts src/client/game
git commit -m "feat: add timed quiz prompts and role abilities"
```

### Task 8: Complete reconnection, match results, and room error states

**Files:**
- Create: `src/client/game/ResultsPanel.tsx`, `src/client/lobby/ConnectionStatus.tsx`, `src/client/lobby/reconnectToken.ts`, `src/client/lobby/reconnectToken.test.ts`
- Create: `src/server/rooms/reconnect.test.ts`, `src/server/rooms/results.test.ts`
- Modify: `src/server/rooms/ClassroomRoom.ts`, `src/server/rooms/ClassroomState.ts`, `src/client/lobby/roomClient.ts`, `src/client/game/GameHud.tsx`

**Interfaces:**
- Consumes: Task 4 room/host lifecycle and Task 7 answer and game scores.
- Produces: 180-second same-player reconnection, explicit full/late-join errors, teacher disconnect pause, and a round summary separating knowledge result from team winner.

- [ ] **Step 1: Write reconnect and results tests**

Assert the browser token restores the same player ID, role, score, and charges before 180 seconds; an expired token cannot reclaim the seat; a nickname alone cannot take over a disconnected seat; team winner and knowledge score are separate result fields.

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `npm test -- --run src/server/rooms/reconnect.test.ts src/server/rooms/results.test.ts src/client/lobby/reconnectToken.test.ts`
Expected: FAIL because reconnect persistence and result summary are missing.

- [ ] **Step 3: Implement token-based student reconnection**

Use Colyseus reconnection support with a 180-second window. Store a random reconnect token in browser session storage and associate its hash with the room’s disconnected player record. Preserve role, charge count, knowledge score, and current question eligibility. Release the seat after expiry.

- [ ] **Step 4: Implement teacher disconnect behavior**

If the teacher disconnects during active play, pause the match and allow that authenticated teacher to resume or end it.

- [ ] **Step 5: Implement visible error and result states**

Show room-full, join-closed, network-disconnected, and reconnect-expired messages. The result panel displays team winner and knowledge score separately. Do not save session results across rooms in the first release.

- [ ] **Step 6: Run reconnect/result tests and commit**

Run: `npm test -- --run src/server/rooms/reconnect.test.ts src/server/rooms/results.test.ts src/client/lobby/reconnectToken.test.ts`
Expected: PASS for the 180-second boundary and nickname-only takeover rejection.

```bash
git add src/client/lobby src/client/game src/server/rooms
git commit -m "feat: handle reconnects and show round results"
```

### Task 9: Package the app for a public HTTPS/WebSocket URL

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `README.md`, `scripts/production-smoke.mjs`, `scripts/classroom-loadtest.ts`
- Modify: `package.json`, `vite.config.ts`, `src/server/index.ts`, `.env.example`

**Interfaces:**
- Consumes: the production Vite/Colyseus build, Supabase URL and publishable key, and Railway `PORT`.
- Produces: one deployable Node service serving the SPA and WebSocket room server over the same HTTPS origin, plus repeatable setup/deploy instructions.

- [ ] **Step 1: Write a production-build smoke check**

Add a Node smoke script that starts the built server, requests `/health`, checks the static root returns the built app, and exits. Do not embed credentials in the script.

- [ ] **Step 2: Run the production smoke check**

Run: `npm run build && npm run smoke:production`
Expected: `/health` returns success, `/` serves the built client, and the smoke script exits nonzero on any failed request.

- [ ] **Step 3: Add Docker packaging and environment documentation**

Build in a Node LTS image, run `npm ci`, `npm run build`, and start `node dist/server/server.mjs`. Set Docker `ARG PORT=2567` and `ENV PORT=$PORT` before the Vite build, then set Railway’s service `PORT=2567` so the plugin’s build-time server port and runtime port match. Use `port: Number(process.env.PORT ?? 2567)` in `vite.config.ts`; retain `serveClient: true` so the client and WebSocket room server share an origin. Document `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` server settings and their `VITE_` browser equivalents. Keep all project secrets out of Git.

- [ ] **Step 4: Run production smoke check and the full project checks**

Run: `npm run smoke:production`
Expected: health returns `{ "status": "ok" }`, the root serves the SPA, and the WebSocket endpoint upgrades successfully.
Run: `npm test -- --run && npm run typecheck && npm run build`
Expected: all checks pass.

- [ ] **Step 5: Rehearse one full 50-client room locally**

Add the official `@colyseus/loadtest` tool as a dev dependency and a custom client script that joins a teacher-created test room, waits for the teacher to start the round, and then sends movement input. Follow the Colyseus load-test CLI help to connect 50 simulated clients to the same room; confirm all 50 appear in the lobby, receive synchronized player state after start, and do not get displaced into another room. Document the repeatable local command and the teacher-controlled setup in `README.md`.

- [ ] **Step 6: Commit deployment packaging**

```bash
git add Dockerfile .dockerignore .env.example README.md package.json vite.config.ts src/server/index.ts scripts
git commit -m "chore: package the game for persistent websocket hosting"
```

- [ ] **Step 7: Deploy after the user connects provider projects and confirms billing**

Create the Railway persistent service from this repository, set the documented environment variables, configure its public HTTPS domain, and apply the Supabase migration to the user’s project. Railway supports long-lived WebSocket connections on HTTP/1.1. The Railway Hobby plan has a $5 monthly minimum that includes $5 of resource usage; usage above that can add charges. Do not upgrade an account or start billable production resources until the user has reviewed the current amount and explicitly authorized it. [Railway networking limits](https://docs.railway.com/networking/public-networking/specs-and-limits) · [Railway pricing](https://railway.com/pricing)

## Source Notes

- Colyseus rooms own synchronized state, process client messages, and support reconnection; its 0.18 fixed-timestep APIs provide server-authoritative input simulation and client prediction. [Rooms](https://docs.colyseus.io/room) · [Server Input & Fixed Timestep](https://docs.colyseus.io/netcode/server-input)
- The Colyseus Vite plugin can serve the built frontend and WebSocket server from one process and origin. [Vite Plugin](https://docs.colyseus.io/server/vite)
- Colyseus provides a load-test tool for simulating concurrent room clients. [Load Testing](https://docs.colyseus.io/tools/loadtest)
- Supabase RLS requires both grants and policies on exposed tables; policies must scope records to the authenticated teacher. [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
