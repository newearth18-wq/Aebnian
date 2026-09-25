export type MapId = "lab" | "library" | "garden";
export type PlayerRole = "hider" | "seeker";
export type MatchPhase = "lobby" | "active" | "paused" | "finished";
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
  label: string;
  description: string;
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
  closesAt: number;
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

export interface QuizQuestionRecord extends QuizPrompt {
  correctOption: number;
}

export interface QuizPack {
  id: string;
  owner_id?: string;
  title: string;
  description: string | null;
  questions: QuizQuestionRecord[];
  created_at?: string;
  updated_at?: string;
}
