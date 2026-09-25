import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Client, type Room } from "@colyseus/sdk";
import { QRCodeSVG } from "qrcode.react";
import { supabase, websocketUrl } from "./client/supabase";
import { deletePack, listPacks, savePack } from "./client/packs/repository";
import { MAPS } from "./shared/mapDefinitions";
import { ClientMessage } from "./shared/protocol";
import type { MapId, QuizPack, QuizQuestionRecord } from "./shared/types";
import type { SceneEffect } from "./client/scene/GameScene";

const GameScene = lazy(() => import("./client/scene/GameScene").then((module) => ({ default: module.GameScene })));

type Screen = "home" | "teacher" | "packs" | "host" | "join" | "play";
type PlayerSnapshot = { id: string; nickname: string; role: "hider" | "seeker"; x: number; z: number; yaw: number; charges: number; knowledgeScore: number; connected: boolean; camouflageHex: string; isTeacher: boolean };
type Snapshot = { phase: "lobby" | "active" | "paused" | "finished"; mapId: MapId; durationMinutes: number; remainingSeconds: number; winner: string | null; quizPrompt: { id: string; text: string; options: string[]; closesAt: number; explanation: string | null; active: boolean } | null; players: Record<string, PlayerSnapshot> };

const webglHelpMessage = "อุปกรณ์นี้ไม่รองรับ WebGL 2 จึงเปิดฉาก 3D ไม่ได้ ลองใช้ Chrome, Edge หรือ Safari รุ่นล่าสุด";
function supportsWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(context);
  } catch { return false; }
}

const emptyQuestion = (): QuizQuestionRecord => ({ id: crypto.randomUUID(), text: "", options: ["", "", "", ""], correctOption: 0, explanation: null, closesAt: 0 });
const emptyPack = (): QuizPack => ({ id: "", title: "", description: "", questions: [emptyQuestion()] });

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [session, setSession] = useState<Session | null>(null);
  const [packs, setPacks] = useState<QuizPack[]>([]);
  const [draft, setDraft] = useState<QuizPack>(emptyPack());
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [room, setRoom] = useState<Room<any> | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [nickname, setNickname] = useState("");
  const [mapId, setMapId] = useState<MapId>("lab");
  const [duration, setDuration] = useState(5);
  const [selectedPack, setSelectedPack] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const gameClient = useMemo(() => new Client(websocketUrl()), []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) { setPacks([]); return; }
    void listPacks(supabase).then((next) => { setPacks(next); setSelectedPack((current) => current || next[0]?.id || ""); }).catch((error) => setMessage(error.message));
  }, [session]);

  useEffect(() => {
    const invite = new URLSearchParams(location.search).get("room");
    if (!invite) return;
    setRoomCode(invite);
    if (!supportsWebGL2()) { setScreen("join"); setMessage(webglHelpMessage); return; }
    const reconnectToken = localStorage.getItem(`aebnian-reconnect:${invite}`);
    if (!reconnectToken) { setScreen("join"); return; }
    void gameClient.reconnect(reconnectToken).then((joined) => {
      const host = localStorage.getItem(`aebnian-role:${invite}`) === "teacher";
      setRoom(joined); setIsTeacher(host); setRoomCode(invite); setNickname(localStorage.getItem(`aebnian-name:${invite}`) || (host ? "ผู้สอน" : "")); setScreen("play");
    }).catch(() => setScreen("join"));
  }, [gameClient]);

  useEffect(() => {
    if (!room) return;
    const receive = (state: any) => setSnapshot(state.toJSON() as Snapshot);
    room.onStateChange(receive);
    receive(room.state);
    return () => { room.onStateChange.remove(receive); };
  }, [room]);

  async function openRoom() {
    if (!supportsWebGL2()) { setMessage(webglHelpMessage); return; }
    if (!session || !selectedPack) { setMessage("เข้าสู่ระบบและเลือกชุดคำถามก่อน"); return; }
    try {
      const joined = await gameClient.create("classroom", { packId: selectedPack, mapId, durationMinutes: duration, teacherToken: session.access_token, nickname: "ผู้สอน" });
      localStorage.setItem(`aebnian-reconnect:${joined.roomId}`, joined.reconnectionToken); localStorage.setItem(`aebnian-role:${joined.roomId}`, "teacher"); localStorage.setItem(`aebnian-name:${joined.roomId}`, "ผู้สอน");
      history.replaceState(null, "", `/?room=${joined.roomId}`);
      setRoom(joined); setIsTeacher(true); setRoomCode(joined.roomId); setScreen("play"); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "สร้างห้องไม่สำเร็จ ตรวจค่า Supabase และลองใหม่"); }
  }

  async function joinRoom() {
    if (!supportsWebGL2()) { setMessage(webglHelpMessage); return; }
    const typedRoomCode = roomCode.trim();
    let joinId = typedRoomCode;
    try { joinId = new URL(typedRoomCode, location.origin).searchParams.get("room")?.trim() || typedRoomCode; } catch { /* plain room code */ }
    if (!joinId || !nickname.trim()) { setMessage("กรอกรหัสห้องหรือลิงก์เชิญ และชื่อเล่นก่อน"); return; }
    try {
      const reconnectKey = `aebnian-reconnect:${joinId}`;
      const token = localStorage.getItem(reconnectKey);
      let joined: Room<any>;
      if (token) {
        try { joined = await gameClient.reconnect(token); }
        catch { joined = await gameClient.joinById(joinId, { nickname: nickname.trim().slice(0, 20), reconnectToken: crypto.randomUUID() }); }
      } else joined = await gameClient.joinById(joinId, { nickname: nickname.trim().slice(0, 20), reconnectToken: crypto.randomUUID() });
      localStorage.setItem(reconnectKey, joined.reconnectionToken);
      localStorage.setItem(`aebnian-role:${joinId}`, "student"); localStorage.setItem(`aebnian-name:${joinId}`, nickname.trim().slice(0, 20));
      history.replaceState(null, "", `/?room=${joinId}`);
      setRoom(joined); setIsTeacher(false); setRoomCode(joinId); setScreen("play"); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "เข้าห้องไม่สำเร็จ"); }
  }

  async function leaveRoom() {
    const code = roomCode;
    await room?.leave();
    if (code) { localStorage.removeItem(`aebnian-reconnect:${code}`); localStorage.removeItem(`aebnian-role:${code}`); localStorage.removeItem(`aebnian-name:${code}`); }
    history.replaceState(null, "", "/"); setRoom(null); setSnapshot(null); setRoomCode(""); setNickname(""); setIsTeacher(false); setScreen("home");
  }

  async function saveCurrentPack() {
    if (!supabase) return;
    try {
      if (!draft.title.trim() || draft.questions.length === 0 || draft.questions.some((q) => !q.text.trim() || q.options.length !== 4 || q.options.some((o) => !o.trim()))) { setMessage("ใส่ชื่อชุดคำถาม โจทย์ และตัวเลือก 4 ข้อให้ครบอย่างน้อย 1 คำถาม"); return; }
      const saved = await savePack(supabase, draft);
      const updated = await listPacks(supabase);
      setPacks(updated); setDraft(saved); setEditing(false); setMessage("บันทึกชุดคำถามแล้ว");
    } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"); }
  }

  async function signIn(form: FormData) {
    if (!supabase) return;
    const email = String(form.get("email") ?? ""); const password = String(form.get("password") ?? "");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message); else { setScreen("packs"); setMessage(""); }
  }

  async function signUp(form: FormData) {
    if (!supabase) return;
    const email = String(form.get("email") ?? ""); const password = String(form.get("password") ?? "");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage(error.message); else setMessage("สมัครแล้ว หากระบบเปิดยืนยันอีเมล โปรดกดยืนยันก่อนเข้าสู่ระบบ");
  }

  function editPack(pack: QuizPack) { setDraft(structuredClone(pack)); setEditing(true); setScreen("packs"); }

  return <main className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => setScreen("home")}><span className="brand-mark">A</span><span>AEBNIAN <small>LEARN TO OUTSMART</small></span></button><div className="top-actions"><span className="online-dot"/> ห้องเรียนพร้อมเล่น <button className="icon-button" aria-label="เมนู">☰</button></div></header>
    {message && <div className="toast" role="status"><span>{message}</span><button onClick={() => setMessage("")}>×</button></div>}
    {screen === "home" && <Home onTeacher={() => { setScreen(session ? "packs" : "teacher"); setMessage(""); }} onJoin={() => { setScreen("join"); setMessage(""); }} />}
    {screen === "teacher" && <TeacherSignIn onBack={() => setScreen("home")} onLogin={signIn} onSignup={signUp} configured={Boolean(supabase)} />}
    {screen === "packs" && <PackStudio session={session} packs={packs} draft={draft} editing={editing} onNew={() => { setDraft(emptyPack()); setEditing(true); setMessage(""); }} onEdit={editPack} onDraft={setDraft} onSave={() => void saveCurrentPack()} onCancel={() => setEditing(false)} onDelete={async (id) => { if (supabase && confirm("ลบชุดคำถามนี้หรือไม่?")) { await deletePack(supabase, id); setPacks(await listPacks(supabase)); } }} onHost={() => { if (!packs.length) { setMessage("สร้างชุดคำถามอย่างน้อยหนึ่งชุดก่อน"); return; } setScreen("host"); }} onLogout={async () => { await supabase?.auth.signOut(); setScreen("home"); }} />}
    {screen === "host" && <HostSetup packs={packs} selectedPack={selectedPack} mapId={mapId} duration={duration} setPack={setSelectedPack} setMap={setMapId} setDuration={setDuration} onBack={() => setScreen("packs")} onStart={() => void openRoom()} />}
    {screen === "join" && <JoinForm nickname={nickname} roomCode={roomCode} setNickname={setNickname} setRoomCode={setRoomCode} onBack={() => setScreen("home")} onJoin={() => void joinRoom()} />}
    {screen === "play" && room && snapshot && <GameRoom room={room} state={snapshot} roomCode={roomCode} nickname={nickname || "ผู้สอน"} isTeacher={isTeacher} onLeave={() => void leaveRoom()} />}
    <footer className="site-footer">AEBNIAN <span>•</span> เรียนรู้ไปด้วยกัน เล่นให้ฉลาดกว่าเดิม</footer>
  </main>;
}

function Home({ onTeacher, onJoin }: { onTeacher: () => void; onJoin: () => void }) {
  return <section className="home-layout">
    <div className="hero-copy"><div className="eyebrow"><span/> CLASSROOM GAME · UP TO 50 PLAYERS</div><h1>ความรู้คือ<br/><em>พลังพิเศษ</em></h1><p>วิ่ง หลบ ซ่อน และใช้ความรู้เอาชนะเพื่อน<br/>เกมซ่อนหาที่ทำให้ทั้งห้องเรียนมีส่วนร่วม</p><div className="hero-actions"><button className="primary-button" onClick={onTeacher}>สร้างห้องสำหรับครู <span>↗</span></button><button className="secondary-button" onClick={onJoin}>เข้าร่วมห้อง <span>→</span></button></div><div className="quick-stats"><div><strong>50</strong><small>ผู้เล่นต่อห้อง</small></div><i/><div><strong>3</strong><small>แมพให้เลือก</small></div><i/><div><strong>∞</strong><small>ชุดคำถามของคุณ</small></div></div></div>
    <div className="hero-art"><div className="art-halo"/><div className="game-card"><div className="game-card-top"><span>LIVE ROUND</span><b><i/> 02:48</b></div><div className="arena"><div className="arena-grid"/><div className="block block-one"/><div className="block block-two"/><div className="block block-three"/><div className="avatar avatar-seeker"><span>◉</span></div><div className="avatar avatar-hider"><span>✦</span></div><div className="radar-ring"/></div><div className="quiz-card"><div className="quiz-icon">✧</div><div><small>คำถามพลังพิเศษ</small><strong>ดาวเคราะห์ดวงใดอยู่ใกล้ดวงอาทิตย์ที่สุด?</strong></div><div className="energy">+1<br/><small>ENERGY</small></div></div><div className="players-line"><span className="mini-avatars">● ● ● ●</span><b>18</b> PLAYERS IN GAME <span className="live-label">● LIVE</span></div></div><div className="floating-tag tag-top">⚡ ANSWER TO POWER UP</div><div className="floating-tag tag-bottom"><span>◉</span> SEEKERS ARE NEAR</div></div>
  </section>;
}

function TeacherSignIn({ onBack, onLogin, onSignup, configured }: { onBack: () => void; onLogin: (form: FormData) => void; onSignup: (form: FormData) => void; configured: boolean }) {
  return <section className="panel-page"><div className="panel-card auth-card"><button className="text-button" onClick={onBack}>← กลับหน้าแรก</button><div className="eyebrow">TEACHER PORTAL</div><h2>เริ่มสร้างเกมของคุณ</h2><p>เข้าสู่ระบบครูเพื่อจัดการชุดคำถามและเปิดห้องเรียน</p>{!configured && <div className="setup-note">ยังไม่ได้ตั้งค่า Supabase — เพิ่ม VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ในไฟล์ .env เพื่อเปิดบัญชีครูและบันทึกชุดคำถาม</div>}<form action={(form) => void onLogin(form)}><label>อีเมล<input name="email" type="email" placeholder="teacher@school.ac.th" required/></label><label>รหัสผ่าน<input name="password" type="password" minLength={6} placeholder="อย่างน้อย 6 ตัวอักษร" required/></label><button className="primary-button full" disabled={!configured}>เข้าสู่ระบบ <span>→</span></button></form><form action={(form) => void onSignup(form)}><button className="text-button" disabled={!configured}>ยังไม่มีบัญชี? <u>สมัครเป็นครู</u></button></form></div></section>;
}

function PackStudio({ session, packs, draft, editing, onNew, onEdit, onDraft, onSave, onCancel, onDelete, onHost, onLogout }: { session: Session | null; packs: QuizPack[]; draft: QuizPack; editing: boolean; onNew: () => void; onEdit: (pack: QuizPack) => void; onDraft: (pack: QuizPack) => void; onSave: () => void; onCancel: () => void; onDelete: (id: string) => void; onHost: () => void; onLogout: () => void }) {
  const updateQuestion = (index: number, changes: Partial<QuizQuestionRecord>) => onDraft({ ...draft, questions: draft.questions.map((q, i) => i === index ? { ...q, ...changes } : q) });
  const moveQuestion = (index: number, offset: number) => { const target = index + offset; if (target < 0 || target >= draft.questions.length) return; const questions = [...draft.questions]; [questions[index], questions[target]] = [questions[target], questions[index]]; onDraft({ ...draft, questions }); };
  return <section className="studio-page"><div className="studio-heading"><div><div className="eyebrow">TEACHER WORKSPACE</div><h2>คลังชุดคำถาม</h2><p>{session?.user.email ?? "โหมดทดลอง"} · จัดชุดคำถามเพื่อเปลี่ยนความรู้ให้เป็นพลัง</p></div><div className="studio-actions"><button className="secondary-button" onClick={onLogout}>ออกจากระบบ</button><button className="primary-button" onClick={onHost}>ตั้งค่าห้อง <span>↗</span></button></div></div>
    {editing ? <div className="editor-card"><div className="editor-head"><div><div className="eyebrow">QUESTION PACK EDITOR</div><h3>{draft.id ? "แก้ไขชุดคำถาม" : "สร้างชุดคำถามใหม่"}</h3></div><button className="icon-button" onClick={onCancel}>×</button></div><label>ชื่อชุดคำถาม<input value={draft.title} onChange={(e) => onDraft({ ...draft, title: e.target.value })} placeholder="เช่น วิทยาศาสตร์ ป.6 — ระบบสุริยะ"/></label><label>คำอธิบาย<textarea value={draft.description ?? ""} onChange={(e) => onDraft({ ...draft, description: e.target.value })} placeholder="หัวข้อหรือระดับชั้น (ไม่บังคับ)" rows={2}/></label>
      {draft.questions.map((q, index) => <article className="question-editor" key={q.id}><div className="question-editor-title"><b>คำถาม {String(index + 1).padStart(2, "0")}</b><div><button className="text-button" disabled={!index} onClick={() => moveQuestion(index, -1)}>↑</button><button className="text-button" disabled={index === draft.questions.length - 1} onClick={() => moveQuestion(index, 1)}>↓</button><button className="text-button danger" onClick={() => onDraft({ ...draft, questions: draft.questions.filter((_, i) => i !== index) })}>ลบคำถาม</button></div></div><input value={q.text} onChange={(e) => updateQuestion(index, { text: e.target.value })} placeholder="พิมพ์โจทย์คำถาม"/><div className="option-grid">{q.options.map((option, optionIndex) => <label className={q.correctOption === optionIndex ? "option-input correct" : "option-input"} key={optionIndex}><span>{String.fromCharCode(65 + optionIndex)}</span><input value={option} onChange={(e) => updateQuestion(index, { options: q.options.map((o, i) => i === optionIndex ? e.target.value : o) })} placeholder={`ตัวเลือก ${String.fromCharCode(65 + optionIndex)}`}/><input aria-label="คำตอบที่ถูก" type="radio" checked={q.correctOption === optionIndex} onChange={() => updateQuestion(index, { correctOption: optionIndex })}/></label>)}</div><input value={q.explanation ?? ""} onChange={(e) => updateQuestion(index, { explanation: e.target.value })} placeholder="คำอธิบายคำตอบ (ไม่บังคับ)"/></article>)}
      <div className="editor-footer"><button className="secondary-button" onClick={() => onDraft({ ...draft, questions: [...draft.questions, emptyQuestion()] })}>＋ เพิ่มคำถาม</button><div><button className="secondary-button" onClick={onCancel}>ยกเลิก</button><button className="primary-button" onClick={onSave}>บันทึกชุดคำถาม <span>✓</span></button></div></div></div> : <><div className="pack-toolbar"><div className="pack-count"><strong>{packs.length.toString().padStart(2, "0")}</strong><span>QUESTION PACKS</span></div><button className="secondary-button" onClick={onNew}>＋ สร้างชุดคำถาม</button></div>{packs.length ? <div className="pack-grid">{packs.map((pack, index) => <article className="pack-card" key={pack.id}><div className={`pack-symbol pack-symbol-${index % 3}`}>{["✳", "⌘", "✦"][index % 3]}</div><div className="pack-card-body"><div className="pack-meta">{pack.questions.length} คำถาม <span>•</span> แก้ไขล่าสุด</div><h3>{pack.title}</h3><p>{pack.description || "ชุดคำถามสำหรับห้องเรียน"}</p><div className="pack-card-actions"><button className="text-button" onClick={() => onEdit(pack)}>แก้ไขชุดคำถาม →</button><button className="text-button" onClick={() => onEdit({ ...structuredClone(pack), id: "", title: pack.title + " (สำเนา)" })}>ทำสำเนา</button><button className="text-button danger" onClick={() => onDelete(pack.id)}>ลบ</button></div></div></article>)}</div> : <div className="empty-state"><div>✧</div><h3>ยังไม่มีชุดคำถาม</h3><p>สร้างชุดคำถามแรกของคุณ แล้วนำไปใช้เปิดห้องเรียนได้ทันที</p><button className="primary-button" onClick={onNew}>สร้างชุดคำถามแรก <span>＋</span></button></div>}</>}
  </section>;
}

function HostSetup({ packs, selectedPack, mapId, duration, setPack, setMap, setDuration, onBack, onStart }: { packs: QuizPack[]; selectedPack: string; mapId: MapId; duration: number; setPack: (id: string) => void; setMap: (id: MapId) => void; setDuration: (value: number) => void; onBack: () => void; onStart: () => void }) {
  return <section className="setup-page"><div className="eyebrow">HOST A NEW ROUND</div><h2>ตั้งค่าเกม</h2><p className="setup-subtitle">เลือกชุดคำถาม แมพ และเวลาเล่น ก่อนส่งลิงก์ให้นักเรียน</p><div className="setup-section"><div className="section-title"><span>01</span><div><b>ชุดคำถาม</b><small>เลือกโจทย์ที่จะเปลี่ยนเป็นพลังพิเศษ</small></div></div><div className="select-wrap"><select value={selectedPack} onChange={(e) => setPack(e.target.value)}>{packs.map((pack) => <option value={pack.id} key={pack.id}>{pack.title} · {pack.questions.length} คำถาม</option>)}</select><span>⌄</span></div></div><div className="setup-section"><div className="section-title"><span>02</span><div><b>เลือกสนาม</b><small>แต่ละสนามมีที่ซ่อนและทางเดินต่างกัน</small></div></div><div className="map-options">{Object.values(MAPS).map((map, index) => <button onClick={() => setMap(map.id)} key={map.id} className={`map-option map-option-${index} ${mapId === map.id ? "selected" : ""}`}><div className="map-preview"><span>{["⚗", "▤", "❋"][index]}</span><b>{map.label}</b></div><small>{map.description}</small></button>)}</div></div><div className="setup-section duration-row"><div className="section-title"><span>03</span><div><b>เวลาเล่น</b><small>กำหนดระยะเวลาของรอบนี้</small></div></div><div className="duration-control"><button onClick={() => setDuration(Math.max(1, duration - 1))}>−</button><strong>{duration}<small>นาที</small></strong><button onClick={() => setDuration(Math.min(15, duration + 1))}>＋</button></div><input aria-label="เวลาเล่น (นาที)" type="range" min={1} max={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))}/></div><div className="setup-footer"><button className="text-button" onClick={onBack}>← กลับไปชุดคำถาม</button><button className="primary-button" onClick={onStart} disabled={!selectedPack}>สร้างห้องเรียน <span>↗</span></button></div></section>;
}

function JoinForm({ nickname, roomCode, setNickname, setRoomCode, onBack, onJoin }: { nickname: string; roomCode: string; setNickname: (value: string) => void; setRoomCode: (value: string) => void; onBack: () => void; onJoin: () => void }) {
  return <section className="panel-page"><div className="panel-card auth-card"><button className="text-button" onClick={onBack}>← กลับหน้าแรก</button><div className="eyebrow">JOIN A CLASSROOM</div><h2>พร้อมลงสนามไหม?</h2><p>ใส่รหัสห้องจากครูและชื่อที่เพื่อนจำได้ ไม่ต้องสมัครบัญชี</p><label>รหัสห้อง<input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="วางรหัสห้องหรือลิงก์เชิญ" autoCapitalize="none"/></label><label>ชื่อเล่น<input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="ชื่อที่ใช้ในเกม" maxLength={20}/></label><button className="primary-button full" onClick={onJoin}>เข้าร่วมห้อง <span>→</span></button></div></section>;
}

function GameRoom({ room, state, roomCode, nickname, isTeacher, onLeave }: { room: Room<any>; state: Snapshot; roomCode: string; nickname: string; isTeacher: boolean; onLeave: () => void }) {
  const players = Object.values(state.players ?? {});
  const students = players.filter((p) => !p.isTeacher);
  const visibleStudents = students.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.z));
  const connectedStudents = students.filter((p) => p.connected);
  const myPlayer = players.find((p) => p.id === room.sessionId);
  const question = state.quizPrompt?.active ? state.quizPrompt : null;
  const [feedback, setFeedback] = useState("");
  const [camouflage, setCamouflage] = useState("#a8c98b");
  const [answeredQuestionId, setAnsweredQuestionId] = useState("");
  const [reveal, setReveal] = useState<{ text: string; options: string[]; correctOption: number; explanation: string } | null>(null);
  const [effects, setEffects] = useState<SceneEffect[]>([]);
  const [, setClock] = useState(Date.now());
  const answer = (optionIndex: number) => { if (question && !answeredQuestionId) { setAnsweredQuestionId(question.id); room.send(ClientMessage.quizAnswer, { questionId: question.id, optionIndex }); } };
  useEffect(() => { if (myPlayer?.camouflageHex) setCamouflage(myPlayer.camouflageHex); }, [myPlayer?.camouflageHex]);
  useEffect(() => {
    const off = room.onMessage("quiz:feedback", (value: { correct: boolean; message?: string }) => { setAnsweredQuestionId(room.state.quizPrompt.id); setFeedback(value.message || (value.correct ? "ถูกต้อง! ได้พลังเพิ่ม 1 หน่วย" : "ยังไม่ถูก ครั้งหน้าลองใหม่!")); });
    const opened = room.onMessage("quiz:opened", () => { setFeedback(""); setAnsweredQuestionId(""); setReveal(null); });
    const closed = room.onMessage("quiz:closed", (value: { correctOption: number; explanation?: string }) => {
      const prompt = room.state.quizPrompt;
      setReveal({ text: prompt.text, options: [...prompt.options], correctOption: value.correctOption, explanation: value.explanation || "" });
      window.setTimeout(() => setReveal(null), 6000);
    });
    const power = room.onMessage("ability:effect", (value: any) => {
      if (value.ability === "scan") {
        const spots = (value.nearby ?? []) as Array<{ x: number; z: number }>;
        setFeedback(spots.length ? `สแกนพบผู้ซ่อน ${spots.length} คนใกล้คุณ` : "ยังไม่พบผู้ซ่อนใกล้ตัว");
        setEffects((current) => [...current, ...spots.map((spot) => ({ id: crypto.randomUUID(), x: spot.x, z: spot.z, kind: "scan" as const, expiresAt: Date.now() + 3000 }))]);
      } else if (value.ability === "decoy") {
        setFeedback("ปล่อยตัวลวงแล้ว");
        setEffects((current) => [...current, { id: crypto.randomUUID(), x: value.x, z: value.z, kind: "decoy", expiresAt: Date.now() + 6000 }]);
      }
    });
    const tick = window.setInterval(() => setClock(Date.now()), 250);
    const cleanup = window.setInterval(() => setEffects((current) => current.filter((effect) => effect.expiresAt > Date.now())), 500);
    return () => { off(); opened(); closed(); power(); window.clearInterval(tick); window.clearInterval(cleanup); };
  }, [room]);
  const copyLink = () => void navigator.clipboard?.writeText(`${location.origin}/?room=${roomCode}`).then(() => setFeedback("คัดลอกลิงก์เข้าห้องแล้ว"));
  const ownId = room.sessionId;
  return <section className="game-page">
    <div className="game-head">
      <div><div className="eyebrow">{state.phase === "lobby" ? "WAITING ROOM" : state.phase === "paused" ? "ROUND PAUSED" : state.phase === "finished" ? "ROUND COMPLETE" : "LIVE ROUND"} · {MAPS[state.mapId]?.label}</div><h2>{state.phase === "lobby" ? "กำลังรอเพื่อนเข้าห้อง" : state.phase === "paused" ? "เกมหยุดชั่วคราว" : state.phase === "finished" ? "จบรอบแล้ว" : "เกมกำลังดำเนินอยู่"}</h2></div>
      <div className="game-head-actions">{isTeacher && state.phase === "lobby" && <div className="qr-card"><QRCodeSVG value={`${location.origin}/?room=${roomCode}`} size={58} bgColor="#ffffff" fgColor="#152017"/><small>สแกนเพื่อเข้าห้อง</small></div>}<button className="room-code" onClick={copyLink}><small>ROOM ID · กดคัดลอกลิงก์</small><b>{roomCode}</b><span>⧉</span></button><div className="timer-pill">◷ {formatTime(state.remainingSeconds)}</div><button className="icon-button" onClick={onLeave} aria-label="ออกจากห้อง">×</button></div>
    </div>
    <div className="game-content">
      <div className="scene-wrap">
        <Suspense fallback={<div className="scene-loading">กำลังเตรียมสนาม 3D…</div>}><GameScene mapId={state.mapId} players={visibleStudents} effects={effects} myId={ownId} phase={state.phase} onMove={(move) => room.send(ClientMessage.move, move)}/></Suspense>
        <div className="scene-caption"><span className="online-dot"/> {connectedStudents.length} / 50 นักเรียนออนไลน์ <b>{state.phase.toUpperCase()}</b></div>
        {(question || reveal) && <div className="quiz-overlay"><div className="quiz-overlay-top"><span>✧ {reveal ? "เฉลยคำถาม" : "คำถามพลังพิเศษ"}</span><b>{state.phase === "paused" ? "พักชั่วคราว" : question ? `${Math.max(0, Math.ceil((question.closesAt - Date.now()) / 1000))} วินาที` : "ปิดรับคำตอบ"}</b></div><h3>{question?.text || reveal?.text}</h3><div className="answer-grid">{(question?.options || reveal?.options || []).map((option, i) => <button className={reveal && reveal.correctOption === i ? "answer-correct" : ""} key={i} disabled={!question || state.phase !== "active" || answeredQuestionId === question.id} onClick={() => answer(i)}><span>{String.fromCharCode(65 + i)}</span>{option}{reveal?.correctOption === i ? " ✓" : ""}</button>)}</div>{reveal?.explanation && <p className="answer-explanation">{reveal.explanation}</p>}{feedback && <small>{feedback}</small>}</div>}
      </div>
      <aside className="game-side">
        <div className="side-card player-card"><div className="side-card-title"><div><div className="eyebrow">PLAYERS</div><h3>ผู้เล่นในห้อง</h3></div><span className="count-pill">{students.length} / 50</span></div><div className="player-list">{players.map((p, i) => <div className="player-row" key={p.id}><span className={`player-avatar pa-${i % 5}`}>{p.nickname.slice(0, 1).toUpperCase()}</span><div><b>{p.nickname}</b><small>{p.isTeacher ? "ครูผู้ดูแล" : p.id === ownId ? (p.role === "seeker" ? "ผู้หา" : "ผู้ซ่อน") : Number.isFinite(p.x) ? (p.role === "seeker" ? "ผู้หา" : "เห็นใกล้ตัว") : "ซ่อนอยู่"}{p.id === ownId ? " · คุณ" : ""}</small></div><span className={p.connected ? "connection live" : "connection"}/></div>)}</div></div>
        {!isTeacher && <div className="side-card ability-card"><div className="eyebrow">SPECIAL ABILITIES</div><h3>พลังของคุณ <span>⚡ {myPlayer?.charges ?? 0}</span></h3><p>ตอบคำถามให้ถูกเพื่อสะสมพลัง แล้วใช้ช่วยทีมของคุณ</p><div className="ability-buttons"><button disabled={!myPlayer?.charges || myPlayer.role !== "hider"} onClick={() => room.send(ClientMessage.useAbility, { ability: "decoy" })}><span>◌</span><b>ตัวลวง</b><small>ผู้ซ่อน · 1 พลัง</small></button><button disabled={!myPlayer?.charges || myPlayer.role !== "seeker"} onClick={() => room.send(ClientMessage.useAbility, { ability: "scan" })}><span>⌖</span><b>สแกนใกล้ตัว</b><small>ผู้หา · 1 พลัง</small></button></div></div>}
        {!isTeacher && myPlayer?.role === "hider" && <div className="side-card camouflage-card"><label htmlFor="camouflage-color"><span><b>สีพรางตัว</b><small>เลือกสีให้กลมกลืนกับสนาม</small></span><input id="camouflage-color" type="color" value={camouflage} onChange={(event) => { setCamouflage(event.target.value); room.send(ClientMessage.setCamouflage, { color: event.target.value }); }}/></label></div>}
        {isTeacher && state.phase === "lobby" && <button className="primary-button full" disabled={connectedStudents.length < 3} onClick={() => room.send(ClientMessage.hostStart)}>{connectedStudents.length < 3 ? `รอนักเรียนอย่างน้อย 3 คน (${connectedStudents.length}/3)` : "เริ่มเกม →"}</button>}
        {isTeacher && state.phase === "active" && <><button className="secondary-button full" onClick={() => room.send(ClientMessage.hostPause)}>พักเกมชั่วคราว</button><button className="text-button leave-button" onClick={() => room.send(ClientMessage.hostEnd)}>จบรอบเกม</button></>}
        {isTeacher && state.phase === "paused" && <button className="primary-button full" onClick={() => room.send(ClientMessage.hostResume)}>กลับเข้าเกมต่อ →</button>}
        <button className="text-button leave-button" onClick={onLeave}>ออกจากห้อง</button>
      </aside>
    </div>
    {state.phase === "finished" && <div className="result-banner"><div><span>ROUND COMPLETE</span><h3>{state.winner === "hiders" ? "ผู้ซ่อนชนะ!" : state.winner === "seekers" ? "ผู้หาชนะ!" : "เสมอกัน"}</h3><p>คะแนนความรู้</p><div className="score-list">{[...students].sort((a, b) => b.knowledgeScore - a.knowledgeScore).slice(0, 4).map((p, index) => <span key={p.id}>{index + 1}. {p.nickname} <b>{p.knowledgeScore}</b></span>)}</div></div><button className="primary-button" onClick={onLeave}>กลับหน้าแรก</button></div>}
  </section>;
}

function formatTime(seconds: number) { const safe = Math.max(0, seconds); return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`; }
