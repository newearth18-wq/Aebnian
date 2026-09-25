import { ArraySchema, MapSchema, Schema, defineTypes } from "@colyseus/schema";

export class PlayerState extends Schema {
  declare id: string;
  declare nickname: string;
  declare role: string;
  // Coordinates are private view fields. NaN makes an unseen player's
  // uninitialized pose easy for clients to distinguish from a real position.
  declare x: number;
  declare z: number;
  declare yaw: number;
  declare camouflageHex: string;
  declare charges: number;
  declare knowledgeScore: number;
  declare connected: boolean;
  declare isTeacher: boolean;

  constructor() {
    super();
    this.id = ""; this.nickname = ""; this.role = "hider";
    this.x = Number.NaN; this.z = Number.NaN; this.yaw = Number.NaN;
    this.camouflageHex = "#a8c98b"; this.charges = 0; this.knowledgeScore = 0;
    this.connected = true; this.isTeacher = false;
  }
}
defineTypes(PlayerState, {
  id: "string", nickname: "string", role: { type: "string", view: true },
  x: { type: "number", view: true }, z: { type: "number", view: true }, yaw: { type: "number", view: true },
  camouflageHex: { type: "string", view: true }, charges: "uint8", knowledgeScore: "uint16", connected: "boolean", isTeacher: "boolean",
});

export class QuizPromptState extends Schema {
  declare active: boolean;
  declare id: string;
  declare text: string;
  declare options: ArraySchema<string>;
  declare explanation: string;
  declare closesAt: number;
  declare correctOption: number;

  constructor() {
    super();
    this.active = false; this.id = ""; this.text = "";
    this.options = new ArraySchema<string>(); this.explanation = "";
    this.closesAt = 0; this.correctOption = -1;
  }
}
defineTypes(QuizPromptState, { active: "boolean", id: "string", text: "string", options: ["string"], explanation: "string", closesAt: "number", correctOption: "int8" });

export class ClassroomState extends Schema {
  declare phase: string;
  declare mapId: string;
  declare durationMinutes: number;
  declare remainingSeconds: number;
  declare winner: string;
  declare teacherConnected: boolean;
  declare players: MapSchema<PlayerState>;
  declare quizPrompt: QuizPromptState;

  constructor() {
    super();
    this.phase = "lobby"; this.mapId = "lab"; this.durationMinutes = 5;
    this.remainingSeconds = 300; this.winner = ""; this.teacherConnected = true;
    this.players = new MapSchema<PlayerState>(); this.quizPrompt = new QuizPromptState();
  }
}
defineTypes(ClassroomState, {
  phase: "string", mapId: "string", durationMinutes: "uint8", remainingSeconds: "uint16", winner: "string", teacherConnected: "boolean",
  players: { map: PlayerState }, quizPrompt: QuizPromptState,
});
