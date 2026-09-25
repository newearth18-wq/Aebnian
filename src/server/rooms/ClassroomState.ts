import { ArraySchema, MapSchema, Schema, defineTypes } from "@colyseus/schema";

export class PlayerState extends Schema {
  id = "";
  nickname = "";
  role = "hider";
  // Coordinates are private view fields. NaN makes an unseen player's
  // uninitialized pose easy for clients to distinguish from a real position.
  x = Number.NaN;
  z = Number.NaN;
  yaw = Number.NaN;
  camouflageHex = "#a8c98b";
  charges = 0;
  knowledgeScore = 0;
  connected = true;
  isTeacher = false;
}
defineTypes(PlayerState, {
  id: "string", nickname: "string", role: { type: "string", view: true },
  x: { type: "number", view: true }, z: { type: "number", view: true }, yaw: { type: "number", view: true },
  camouflageHex: { type: "string", view: true }, charges: "uint8", knowledgeScore: "uint16", connected: "boolean", isTeacher: "boolean",
});

export class QuizPromptState extends Schema {
  active = false;
  id = "";
  text = "";
  options = new ArraySchema<string>();
  explanation = "";
  closesAt = 0;
  correctOption = -1;
}
defineTypes(QuizPromptState, { active: "boolean", id: "string", text: "string", options: ["string"], explanation: "string", closesAt: "number", correctOption: "int8" });

export class ClassroomState extends Schema {
  phase = "lobby";
  mapId = "lab";
  durationMinutes = 5;
  remainingSeconds = 300;
  winner = "";
  teacherConnected = true;
  players = new MapSchema<PlayerState>();
  quizPrompt = new QuizPromptState();
}
defineTypes(ClassroomState, {
  phase: "string", mapId: "string", durationMinutes: "uint8", remainingSeconds: "uint16", winner: "string", teacherConnected: "boolean",
  players: { map: PlayerState }, quizPrompt: QuizPromptState,
});
