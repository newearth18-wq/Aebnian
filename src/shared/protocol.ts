export const ClientMessage = {
  move: "move",
  quizAnswer: "quiz:answer",
  useAbility: "ability:use",
  setCamouflage: "camouflage:set",
  hostStart: "host:start",
  hostPause: "host:pause",
  hostResume: "host:resume",
  hostEnd: "host:end",
} as const;

export const ServerMessage = {
  quizOpened: "quiz:opened",
  quizClosed: "quiz:closed",
  answerFeedback: "quiz:feedback",
  roomError: "room:error",
  powerEffect: "ability:effect",
  gameEnded: "game:ended",
} as const;

export type AbilityKind = "decoy" | "scan";
