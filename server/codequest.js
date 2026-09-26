// ============================================================================
// codequest.js — ห้องเล่นออนไลน์ของเกม CodeQuest Universe
// แยกออกจากระบบห้องของเกมเมฉะโดยสิ้นเชิง (คนละ WebSocket path คนละ Map)
// โปรโตคอลใช้คีย์สั้น ๆ เพราะข้อความ progress ถูกส่งบ่อยระหว่างแข่ง
// ============================================================================
const rooms = new Map();          // code -> room
const MAX_PLAYERS = 4;
const EMPTY_ROOM_TTL = 10 * 60 * 1000;   // ห้องร้างเกิน 10 นาทีให้เก็บกวาด
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // ตัดตัวที่อ่านสับสน (I,L,O,0,1)

function newCode(){
  for(let tries = 0; tries < 50; tries++){
    let c = '';
    for(let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if(!rooms.has(c)) return c;
  }
  return 'R' + Date.now().toString(36).slice(-3).toUpperCase();
}

const send = (ws, msg) => { if(ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };

function broadcast(room, msg, exceptId){
  const payload = JSON.stringify(msg);
  for(const p of room.players.values()){
    if(p.id === exceptId) continue;
    if(p.ws && p.ws.readyState === 1) p.ws.send(payload);
  }
}

const roster = room => [...room.players.values()].map(p => ({
  id: p.id, name: p.name, color: p.color, host: p.id === room.hostId,
  ready: p.ready, done: p.done, gems: p.gems, blocks: p.blocks,
  stars: p.stars, secs: p.secs, score: p.score, online: p.ws && p.ws.readyState === 1,
}));

const pushRoster = room => broadcast(room, { t:'players', players: roster(room), host: room.hostId });

const COLORS = ['#2d8fdd', '#ef4a76', '#34a853', '#f2a103'];

function touch(room){ room.lastSeen = Date.now(); }

// ---------------------------------------------------------------------------
function handleMessage(data, conn, ws){
  switch(data.t){
    case 'create': return onCreate(data, conn, ws);
    case 'join':   return onJoin(data, conn, ws);
    case 'setup':  return onSetup(data, conn);
    case 'start':  return onStart(data, conn);
    case 'prog':   return onProgram(data, conn);
    case 'progress': return onProgress(data, conn);
    case 'finish': return onFinish(data, conn);
    case 'react':  return onReact(data, conn);
    case 'again':  return onAgain(data, conn);
    case 'leave':  return onLeave(conn);
    case 'ping':   return send(conn.ws, { t:'pong' });
    default: return send(conn.ws, { t:'error', msg:'คำสั่งไม่ถูกต้อง' });
  }
}

function makePlayer(conn, ws, name, idx){
  return { id: conn.id, name: (name || 'ผู้เล่น').slice(0, 12), ws,
           color: COLORS[idx % COLORS.length], ready:false, done:false,
           gems:0, blocks:0, stars:0, secs:0, score:0 };
}

function onCreate(data, conn, ws){
  if(conn.room) onLeave(conn);
  const code = newCode();
  const room = {
    code, hostId: conn.id, players: new Map(), state: 'lobby',
    mode: 'race', level: null, startAt: 0, lastSeen: Date.now(),
    program: null, turn: 0,
  };
  room.players.set(conn.id, makePlayer(conn, ws, data.name, 0));
  rooms.set(code, room);
  conn.room = code;
  send(ws, { t:'joined', code, you: conn.id, host: true });
  pushRoster(room);
  console.log(`[cq] สร้างห้อง ${code}`);
}

function onJoin(data, conn, ws){
  const code = String(data.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if(!room) return send(ws, { t:'error', msg:'ไม่พบห้องรหัสนี้ ลองตรวจตัวอักษรอีกครั้ง' });
  if(room.state !== 'lobby') return send(ws, { t:'error', msg:'ห้องนี้เริ่มเล่นไปแล้ว รอรอบถัดไปนะ' });
  if(room.players.size >= MAX_PLAYERS) return send(ws, { t:'error', msg:'ห้องเต็มแล้ว (สูงสุด 4 คน)' });
  if(conn.room) onLeave(conn);
  room.players.set(conn.id, makePlayer(conn, ws, data.name, room.players.size));
  conn.room = code;
  touch(room);
  send(ws, { t:'joined', code, you: conn.id, host: false, mode: room.mode, level: room.level });
  pushRoster(room);
}

const roomOf = conn => conn.room ? rooms.get(conn.room) : null;

function onSetup(data, conn){
  const room = roomOf(conn);
  if(!room || room.hostId !== conn.id) return;
  if(data.mode) room.mode = data.mode === 'coop' ? 'coop' : 'race';
  if(data.level) room.level = data.level;      // { w, id } ของด่านที่เลือก
  touch(room);
  broadcast(room, { t:'setup', mode: room.mode, level: room.level });
}

function onStart(data, conn){
  const room = roomOf(conn);
  if(!room || room.hostId !== conn.id) return;
  if(!room.level) return send(conn.ws, { t:'error', msg:'ยังไม่ได้เลือกด่าน' });
  room.state = 'playing';
  room.startAt = Date.now();
  room.program = null;
  room.turn = 0;
  for(const p of room.players.values()){
    p.done = false; p.gems = 0; p.blocks = 0; p.stars = 0; p.secs = 0; p.score = 0;
  }
  touch(room);
  const order = [...room.players.keys()];
  broadcast(room, { t:'start', mode: room.mode, level: room.level, order });
}

// โหมดร่วมมือ: คนที่ถึงตาส่งโปรแกรมทั้งชุดมา แล้วกระจายให้ทุกคนเห็นตรงกัน
function onProgram(data, conn){
  const room = roomOf(conn);
  if(!room || room.state !== 'playing' || room.mode !== 'coop') return;
  const order = [...room.players.keys()];
  if(order[room.turn % order.length] !== conn.id) return;    // ยังไม่ถึงตา
  room.program = { program: data.program, func: data.func };
  room.turn = (room.turn + 1) % order.length;
  touch(room);
  broadcast(room, { t:'prog', program: data.program, func: data.func, turn: room.turn, by: conn.id });
}

function onProgress(data, conn){
  const room = roomOf(conn);
  if(!room || room.state !== 'playing') return;
  const p = room.players.get(conn.id);
  if(!p) return;
  p.gems = data.gems | 0;
  p.blocks = data.blocks | 0;
  touch(room);
  broadcast(room, { t:'progress', id: conn.id, gems: p.gems, blocks: p.blocks }, conn.id);
}

function onFinish(data, conn){
  const room = roomOf(conn);
  if(!room || room.state !== 'playing') return;
  const p = room.players.get(conn.id);
  if(!p || p.done) return;
  p.done = true;
  p.blocks = data.blocks | 0;
  p.secs = Math.max(1, data.secs | 0);
  p.stars = Math.min(3, Math.max(1, data.stars | 0));
  p.score = Math.max(0, p.stars * 100 - p.blocks * 3 - p.secs);
  touch(room);
  broadcast(room, { t:'finished', id: conn.id, name: p.name, score: p.score,
                    stars: p.stars, blocks: p.blocks, secs: p.secs });

  if(room.mode === 'coop' || [...room.players.values()].every(x => x.done)){
    room.state = 'lobby';
    const board = roster(room).filter(x => x.done).sort((a,b) => b.score - a.score);
    broadcast(room, { t:'results', board, mode: room.mode });
  }
}

function onReact(data, conn){
  const room = roomOf(conn);
  if(!room) return;
  const p = room.players.get(conn.id);
  if(!p) return;
  broadcast(room, { t:'react', id: conn.id, name: p.name, emoji: String(data.emoji || '👍').slice(0, 4) });
}

function onAgain(data, conn){
  const room = roomOf(conn);
  if(!room || room.hostId !== conn.id) return;
  room.state = 'lobby';
  for(const p of room.players.values()){ p.done = false; p.gems = 0; p.blocks = 0; }
  touch(room);
  broadcast(room, { t:'lobby' });
  pushRoster(room);
}

function onLeave(conn){
  const room = roomOf(conn);
  conn.room = null;
  if(!room) return;
  room.players.delete(conn.id);
  if(room.players.size === 0){
    rooms.delete(room.code);
    console.log(`[cq] ปิดห้อง ${room.code} (ไม่มีคนเหลือ)`);
    return;
  }
  // เจ้าของห้องออก ให้คนถัดไปเป็นเจ้าของแทน ไม่งั้นห้องจะค้างไปตลอด
  if(room.hostId === conn.id) room.hostId = [...room.players.keys()][0];
  broadcast(room, { t:'left', id: conn.id });
  pushRoster(room);
}

// เก็บกวาดห้องที่ไม่มีความเคลื่อนไหว (Render ฟรีเทียร์รีสตาร์ทเองอยู่แล้ว แต่กันเหนียวไว้)
setInterval(() => {
  const now = Date.now();
  for(const [code, room] of rooms){
    const alive = [...room.players.values()].some(p => p.ws && p.ws.readyState === 1);
    if(!alive && now - room.lastSeen > EMPTY_ROOM_TTL){
      rooms.delete(code);
      console.log(`[cq] เก็บกวาดห้องร้าง ${code}`);
    }
  }
}, 60 * 1000).unref?.();

module.exports = { handleMessage, onLeave, rooms };
