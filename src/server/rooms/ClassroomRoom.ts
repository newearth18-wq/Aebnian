import { CloseCode, Room, type Client } from "colyseus";
import { StateView } from "@colyseus/schema";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ClassroomState, PlayerState } from "./ClassroomState";
import { ClientMessage, ServerMessage, type AbilityKind } from "../../shared/protocol";
import { MAPS } from "../../shared/mapDefinitions";
import { applyMovement } from "../../shared/movement";
import type { MapId, MoveInput, QuizQuestionRecord, RoomSetup } from "../../shared/types";

type JoinAuth = { isTeacher: boolean; userId?: string; reconnectToken: string };
type RoomOptions = RoomSetup & { teacherToken: string; nickname?: string };
type QuestionRow = { id: string; prompt: string; options: string[]; correct_option: number; explanation: string | null };
const PASSIVE_HIDER_REVEAL_RADIUS = 4;
const SEEKER_SCAN_RADIUS = 10;

function supabaseFor(token?: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("ยังไม่ได้ตั้งค่า Supabase บนเซิร์ฟเวอร์ (SUPABASE_URL / SUPABASE_ANON_KEY)");
  return createClient(url, anonKey, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined);
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

export class ClassroomRoom extends Room<{ state: ClassroomState }> {
  maxClients = 51;
  private teacherId = "";
  private teacherSessionId = "";
  private setup!: RoomSetup;
  private mapId: MapId = "lab";
  private questions: QuizQuestionRecord[] = [];
  private activeQuestion: QuizQuestionRecord | null = null;
  private questionOrder: string[] = [];
  private answeredPlayers = new Set<string>();
  private nextQuestionAt = 0;
  private roundEndsAt = 0;
  private pauseStartedAt = 0;
  private reconnectTimer = new Map<string, ReturnType<typeof setTimeout>>();
  private reconnectTokens = new Map<string, string>();
  private connectedTeacherClient?: Client;

  async onCreate(options: RoomOptions) {
    if (!options?.teacherToken || !options.packId || !(options.mapId in MAPS) || !Number.isInteger(options.durationMinutes) || options.durationMinutes < 1 || options.durationMinutes > 15) throw new Error("การตั้งค่าห้องไม่ถูกต้อง");
    const db = supabaseFor(options.teacherToken);
    const { data: userResult, error: authError } = await db.auth.getUser(options.teacherToken);
    if (authError || !userResult.user) throw new Error("บัญชีครูหมดอายุ กรุณาเข้าสู่ระบบใหม่");
    const { data: pack, error: packError } = await db.from("quiz_packs").select("id,quiz_questions(id,prompt,options,correct_option,explanation,position)").eq("id", options.packId).eq("owner_id", userResult.user.id).single();
    if (packError || !pack) throw new Error("ไม่พบชุดคำถาม หรือบัญชีนี้ไม่มีสิทธิ์ใช้ชุดคำถามนี้");
    const rows = ((pack as any).quiz_questions ?? []) as (QuestionRow & { position: number })[];
    if (!rows.length) throw new Error("ชุดคำถามนี้ยังไม่มีคำถาม");
    this.questions = rows.sort((a, b) => a.position - b.position).map((row) => ({ id: row.id, text: row.prompt, options: row.options, correctOption: row.correct_option, explanation: row.explanation, closesAt: 0 }));
    this.teacherId = userResult.user.id; this.mapId = options.mapId; this.setup = { packId: options.packId, mapId: options.mapId, durationMinutes: options.durationMinutes };
    this.state = new ClassroomState(); this.state.mapId = options.mapId; this.state.durationMinutes = options.durationMinutes; this.state.remainingSeconds = options.durationMinutes * 60;
    this.maxMessagesPerSecond = 30; this.patchRate = 50;
    this.setSimulationInterval(() => this.step(), 50);
    this.registerMessages();
    this.setMetadata({ mapId: this.mapId, durationMinutes: options.durationMinutes });
  }

  async onAuth(_client: Client, options: { teacherToken?: string; nickname?: string; reconnectToken?: string }) {
    const reconnectToken = options.reconnectToken;
    if (reconnectToken && [...this.reconnectTokens.values()].includes(reconnectToken)) {
      const [sessionId] = [...this.reconnectTokens.entries()].find(([, token]) => token === reconnectToken)!;
      const player = this.state.players.get(sessionId);
      if (player && player.connected === false) return { isTeacher: sessionId === this.teacherSessionId, userId: this.teacherId, reconnectToken } satisfies JoinAuth;
    }
    if (options.teacherToken) {
      const db = supabaseFor(options.teacherToken);
      const { data, error } = await db.auth.getUser(options.teacherToken);
      if (!error && data.user?.id === this.teacherId && !this.teacherSessionId) return { isTeacher: true, userId: data.user.id, reconnectToken: crypto.randomUUID() } satisfies JoinAuth;
      throw new Error("บัญชีนี้ไม่ได้เป็นครูผู้สร้างห้อง");
    }
    if (this.state.phase !== "lobby") throw new Error("เกมเริ่มแล้ว ไม่สามารถเข้าห้องใหม่ได้");
    if ([...this.state.players.values()].filter((player) => !player.isTeacher).length >= 50) throw new Error("ห้องนี้เต็มแล้ว (สูงสุด 50 นักเรียน)");
    const name = typeof options.nickname === "string" ? options.nickname.trim() : "";
    if (!name || name.length > 20) throw new Error("กรุณาใส่ชื่อเล่นไม่เกิน 20 ตัวอักษร");
    const token = reconnectToken && /^[a-zA-Z0-9-]{12,64}$/.test(reconnectToken) ? reconnectToken : crypto.randomUUID();
    if ([...this.reconnectTokens.values()].includes(token)) throw new Error("โทเคนเชื่อมต่อซ้ำ กรุณาโหลดหน้าใหม่");
    return { isTeacher: false, reconnectToken: token } satisfies JoinAuth;
  }

  onJoin(client: Client, options: { nickname?: string }, auth: JoinAuth) {
    const reconnecting = this.state.players.get(client.sessionId);
    if (reconnecting) {
      const timer = this.reconnectTimer.get(client.sessionId); if (timer) clearTimeout(timer); this.reconnectTimer.delete(client.sessionId);
      reconnecting.connected = true; this.reconnectTokens.set(client.sessionId, auth.reconnectToken);
      if (auth.isTeacher) { this.state.teacherConnected = true; this.connectedTeacherClient = client; }
      this.attachView(client);
      this.refreshPlayerViews();
      return;
    }
    if (auth.isTeacher) { this.teacherSessionId = client.sessionId; this.connectedTeacherClient = client; }
    const player = new PlayerState();
    player.id = client.sessionId; player.nickname = auth.isTeacher ? "ผู้สอน" : String(options.nickname ?? "ผู้เล่น").trim().slice(0, 20); player.role = "hider"; player.connected = true; player.isTeacher = auth.isTeacher;
    const spawn = MAPS[this.mapId].spawnPoints[this.state.players.size % MAPS[this.mapId].spawnPoints.length]; player.x = spawn.x; player.z = spawn.z; player.yaw = spawn.yaw;
    this.state.players.set(client.sessionId, player); this.reconnectTokens.set(client.sessionId, auth.reconnectToken);
    this.attachView(client);
    this.refreshPlayerViews();
    client.send("room:ready", { isTeacher: auth.isTeacher, reconnectToken: auth.reconnectToken });
  }

  async onLeave(client: Client, code?: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    client.view?.dispose();
    player.connected = false;
    this.refreshPlayerViews();
    if (code === CloseCode.CONSENTED) {
      if (client.sessionId === this.teacherSessionId) await this.endMatch("draw");
      else { this.state.players.delete(client.sessionId); this.reconnectTokens.delete(client.sessionId); }
      this.refreshPlayerViews();
      if (this.state.phase === "active" && ![...this.state.players.values()].some((p) => !p.isTeacher && p.role === "hider")) void this.endMatch("seekers");
      return;
    }
    if (client.sessionId === this.teacherSessionId) {
      this.state.teacherConnected = false;
      if (this.state.phase === "active") { this.state.phase = "paused"; this.pauseStartedAt = Date.now(); }
    }
    const defer = this.allowReconnection(client, 180);
    this.reconnectTimer.set(client.sessionId, setTimeout(() => {
      this.state.players.delete(client.sessionId); this.reconnectTokens.delete(client.sessionId); this.reconnectTimer.delete(client.sessionId);
      this.refreshPlayerViews();
      if (client.sessionId === this.teacherSessionId && this.state.phase !== "finished") void this.endMatch("draw");
      else if (this.state.phase === "active" && ![...this.state.players.values()].some((p) => !p.isTeacher && p.role === "hider")) void this.endMatch("seekers");
    }, 180_000));
    try {
      const nextClient = await defer;
      const restored = this.state.players.get(client.sessionId);
      if (restored) restored.connected = true;
      if (client.sessionId === this.teacherSessionId) { this.connectedTeacherClient = nextClient; this.state.teacherConnected = true; }
      this.attachView(nextClient);
      this.refreshPlayerViews();
    } catch { /* the reconnect timeout removes the abandoned player */ }
  }

  onDispose() { for (const timer of this.reconnectTimer.values()) clearTimeout(timer); }

  private registerMessages() {
    this.onMessage(ClientMessage.move, (client, payload: MoveInput) => {
      if (this.state.phase !== "active" || !payload || typeof payload !== "object") return;
      const player = this.state.players.get(client.sessionId); if (!player?.connected) return;
      const next = applyMovement({ x: player.x, z: player.z, yaw: player.yaw }, payload, 0.05, MAPS[this.mapId]); player.x = next.x; player.z = next.z; player.yaw = next.yaw;
    });
    this.onMessage(ClientMessage.hostStart, (client) => { if (client.sessionId === this.teacherSessionId) this.startMatch(); });
    this.onMessage(ClientMessage.hostPause, (client) => { if (client.sessionId === this.teacherSessionId && this.state.phase === "active") { this.state.phase = "paused"; this.pauseStartedAt = Date.now(); } });
    this.onMessage(ClientMessage.hostResume, (client) => { if (client.sessionId === this.teacherSessionId && this.state.phase === "paused") this.resumeMatch(); });
    this.onMessage(ClientMessage.hostEnd, (client) => { if (client.sessionId === this.teacherSessionId) void this.endMatch("draw"); });
    this.onMessage(ClientMessage.quizAnswer, (client, payload: { questionId?: unknown; optionIndex?: unknown }) => this.answerQuestion(client, payload));
    this.onMessage(ClientMessage.useAbility, (client, payload: { ability?: unknown }) => this.useAbility(client, payload?.ability));
    this.onMessage(ClientMessage.setCamouflage, (client, payload: { color?: unknown }) => { const player = this.state.players.get(client.sessionId); if (player && !player.isTeacher && player.role === "hider" && typeof payload?.color === "string" && /^#[0-9a-fA-F]{6}$/.test(payload.color)) player.camouflageHex = payload.color; });
  }

  private startMatch() {
    if (this.state.phase !== "lobby" || this.state.players.size < 3) { this.connectedTeacherClient?.send(ServerMessage.roomError, { message: "ต้องมีผู้เล่นอย่างน้อย 3 คนจึงเริ่มเกมได้" }); return; }
    const ids = shuffle([...this.state.players.entries()].filter(([, player]) => !player.isTeacher && player.connected).map(([id]) => id));
    if (ids.length < 3) { this.connectedTeacherClient?.send(ServerMessage.roomError, { message: "ต้องมีนักเรียนอย่างน้อย 3 คนจึงเริ่มเกมได้" }); return; }
    const seekerCount = Math.max(1, Math.ceil(ids.length / 10));
    ids.forEach((id, index) => { const player = this.state.players.get(id)!; player.role = index < seekerCount ? "seeker" : "hider"; });
    this.refreshPlayerViews();
    const now = Date.now();
    this.state.phase = "active"; this.state.remainingSeconds = this.setup.durationMinutes * 60; this.roundEndsAt = now + this.setup.durationMinutes * 60_000; this.nextQuestionAt = now + 60_000;
    this.openQuestion();
  }

  private step() {
    if (this.state.phase !== "active") return;
    const now = Date.now();
    const remainingMs = Math.max(0, this.roundEndsAt - now); this.state.remainingSeconds = Math.ceil(remainingMs / 1000);
    if (this.state.quizPrompt.active && now >= this.state.quizPrompt.closesAt) this.closeQuestion();
    const students = [...this.state.players.values()].filter((p) => !p.isTeacher);
    const seekers = students.filter((p) => p.role === "seeker" && p.connected);
    const hiders = students.filter((p) => p.role === "hider");
    for (const seeker of seekers) for (const hider of hiders) if (hider.role === "hider" && hider.connected && Math.hypot(seeker.x - hider.x, seeker.z - hider.z) <= 1.4) { hider.role = "seeker"; hider.charges = Math.min(hider.charges, 2); this.broadcast("player:caught", { nickname: hider.nickname }); }
    this.refreshPlayerViews();
    if (!students.some((p) => p.role === "hider")) void this.endMatch("seekers");
    else if (remainingMs <= 0) void this.endMatch("hiders");
    else if (now >= this.nextQuestionAt) { this.openQuestion(); this.nextQuestionAt = now + 60_000; }
  }

  private openQuestion() {
    if (!this.questions.length || this.state.phase !== "active") return;
    if (!this.questionOrder.length) {
      const next = shuffle(this.questions.map((question) => question.id));
      if (next.length > 1 && next[0] === this.state.quizPrompt.id) [next[0], next[1]] = [next[1], next[0]];
      this.questionOrder = next;
    }
    const questionId = this.questionOrder.shift()!; const question = this.questions.find((candidate) => candidate.id === questionId)!;
    this.activeQuestion = question;
    this.answeredPlayers.clear();
    this.state.quizPrompt.active = true; this.state.quizPrompt.id = question.id; this.state.quizPrompt.text = question.text; this.state.quizPrompt.options.length = 0; this.state.quizPrompt.options.push(...question.options); this.state.quizPrompt.explanation = ""; this.state.quizPrompt.correctOption = -1; this.state.quizPrompt.closesAt = Date.now() + 15_000;
    this.broadcast(ServerMessage.quizOpened, { closesAt: this.state.quizPrompt.closesAt });
  }

  private closeQuestion() {
    this.state.quizPrompt.active = false;
    this.state.quizPrompt.explanation = this.activeQuestion?.explanation ?? "";
    this.state.quizPrompt.correctOption = this.activeQuestion?.correctOption ?? -1;
    this.broadcast(ServerMessage.quizClosed, { explanation: this.state.quizPrompt.explanation, correctOption: this.state.quizPrompt.correctOption });
    this.activeQuestion = null;
  }

  private resumeMatch() {
    const pausedFor = Math.max(0, Date.now() - this.pauseStartedAt);
    if (this.state.quizPrompt.active) this.state.quizPrompt.closesAt += pausedFor;
    this.nextQuestionAt += pausedFor; this.roundEndsAt += pausedFor;
    this.pauseStartedAt = 0; this.state.phase = "active";
  }

  private answerQuestion(client: Client, payload: { questionId?: unknown; optionIndex?: unknown }) {
    if (this.state.phase !== "active" || !this.state.quizPrompt.active || typeof payload?.questionId !== "string" || !Number.isInteger(payload.optionIndex) || payload.questionId !== this.state.quizPrompt.id || Date.now() >= this.state.quizPrompt.closesAt) return;
    const player = this.state.players.get(client.sessionId); const question = this.questions.find((entry) => entry.id === payload.questionId);
    if (!player || player.isTeacher || !question || this.answeredPlayers.has(client.sessionId)) return;
    this.answeredPlayers.add(client.sessionId);
    const correct = payload.optionIndex === question.correctOption;
    if (correct) { player.charges = Math.min(2, player.charges + 1); player.knowledgeScore = Math.min(65535, player.knowledgeScore + 1); }
    client.send(ServerMessage.answerFeedback, { correct, message: correct ? "ถูกต้อง! ได้พลังเพิ่ม 1 หน่วย" : "ยังไม่ถูก ครั้งหน้าลองใหม่" });
  }

  private useAbility(client: Client, abilityValue: unknown) {
    const player = this.state.players.get(client.sessionId); if (!player || player.isTeacher || this.state.phase !== "active" || player.charges < 1) return;
    const ability = abilityValue as AbilityKind;
    if (ability === "decoy" && player.role === "hider") {
      const angle = Math.random() * Math.PI * 2; const distance = 3 + Math.random() * 2; const bounds = MAPS[this.mapId].bounds;
      const x = Math.max(bounds.minX + 1, Math.min(bounds.maxX - 1, player.x + Math.cos(angle) * distance));
      const z = Math.max(bounds.minZ + 1, Math.min(bounds.maxZ - 1, player.z + Math.sin(angle) * distance));
      player.charges--; this.broadcast(ServerMessage.powerEffect, { ability, x, z, owner: client.sessionId });
      this.clock.setTimeout(() => this.broadcast("ability:decoy:clear", { owner: client.sessionId }), 6_000);
    } else if (ability === "scan" && player.role === "seeker") {
      player.charges--; const nearby = [...this.state.players.values()].filter((other) => !other.isTeacher && other.role === "hider" && other.connected && Math.hypot(other.x - player.x, other.z - player.z) <= SEEKER_SCAN_RADIUS).map((other) => ({ x: other.x, z: other.z }));
      client.send(ServerMessage.powerEffect, { ability, nearby, durationMs: 3_000 });
    }
  }

  private async endMatch(winner: "hiders" | "seekers" | "draw") {
    if (this.state.phase === "finished") return;
    if (this.state.quizPrompt.active) this.closeQuestion();
    this.state.phase = "finished"; this.state.winner = winner; this.state.quizPrompt.active = false;
    this.broadcast(ServerMessage.gameEnded, { winner });
  }

  private attachView(client: Client) {
    client.view?.dispose();
    client.view = new StateView();
  }

  private refreshPlayerViews() {
    const players = [...this.state.players.values()].filter((player) => !player.isTeacher);
    for (const client of this.clients) {
      const viewer = this.state.players.get(client.sessionId);
      const view = client.view;
      if (!viewer || !view) continue;
      for (const target of players) {
        const distance = Math.hypot(target.x - viewer.x, target.z - viewer.z);
        const visible = viewer.isTeacher || target.id === viewer.id || target.role === "seeker" || (viewer.role === "seeker" && target.role === "hider" && distance <= PASSIVE_HIDER_REVEAL_RADIUS);
        if (visible && !view.has(target)) view.add(target);
        else if (!visible && view.has(target)) view.remove(target);
      }
    }
  }
}
