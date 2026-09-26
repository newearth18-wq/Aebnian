// ============================================================================
// codequest-server.js — เซิร์ฟเวอร์ของ CodeQuest Universe (แยกจากเกมแอบเนียนทั้งหมด)
//
// รันคนละ service คนละ URL คนละโปรเซส ไม่แตะโค้ดหรือฐานข้อมูลของเกมแอบเนียนเลย
// เกมจะเล่นคนเดียวได้อยู่แล้วโดยไม่ต้องมีเซิร์ฟเวอร์ — ตัวนี้มีไว้เพื่อ "เล่นออนไลน์คนละเครื่อง" เท่านั้น
//
// รันเอง:  node server/codequest-server.js       (ค่าเริ่มต้นพอร์ต 3100)
// ============================================================================
const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const WebSocket = require('ws');
const codequest = require('./codequest');
const accounts = require('./accounts');

const app = express();
const PORT = process.env.PORT || 3100;
const GAME_FILE = path.join(__dirname, '..', 'codequest-universe.html');

app.use(cors());
app.use(express.json({ limit: '128kb' }));

// ---- บัญชีผู้เล่น: เก็บความก้าวหน้าไว้เล่นต่อข้ามเครื่อง ----
const fail = (res, e) => res.status(400).json({ error: e.message || 'ผิดพลาด' });

app.post('/api/account/new', async (req, res) => {
  try { res.json({ code: await accounts.create(req.body?.name, req.body?.data) }); }
  catch (e) { fail(res, e); }
});
app.post('/api/account/save', async (req, res) => {
  try { await accounts.save(req.body?.code, req.body?.data); res.json({ ok: true }); }
  catch (e) { fail(res, e); }
});
app.post('/api/account/load', async (req, res) => {
  try { res.json({ data: await accounts.load(req.body?.code) }); }
  catch (e) { fail(res, e); }
});

// หน้าเกมอยู่ที่รากเลย เพื่อให้หน้าเว็บหา WebSocket ของตัวเองได้จาก location.origin
app.get(['/', '/index.html', '/codequest'], (req, res) => res.sendFile(GAME_FILE));

// ไว้ให้ Render (หรือ uptime monitor) เช็กว่ายังมีชีวิตอยู่
app.get('/health', async (req, res) => res.json({ ok: true,
  service: process.env.RENDER_SERVICE_NAME || '(รันในเครื่อง)',   // จะได้รู้ว่ากำลังคุยกับ service ไหน
  rooms: codequest.rooms.size, up: process.uptime() | 0,
  accounts: await accounts.count().catch(() => -1), ...accounts.status() }));

const server = http.createServer(app);

// รับ WebSocket ทั้ง /cq และ / เพราะเซิร์ฟเวอร์ตัวนี้มีเกมเดียว ไม่มีอะไรให้ชนกัน
const wss = new WebSocket.Server({ server });

// ผู้เล่นที่เน็ตหลุดหรือปิดจอมือถือจะไม่ส่ง close มาให้ (TCP ค้างอยู่ที่ proxy)
// ถ้าไม่ตรวจสอบเอง ห้องจะมีผีค้างเป็นเจ้าของห้องตลอดไป และคนอื่นจะเริ่มรอบใหม่ไม่ได้
//
// ping ระดับโปรโตคอลใช้ไม่ได้ผลบน Render เพราะ proxy ตอบ pong แทนให้เอง —
// พิสูจน์ได้แค่ว่า proxy ยังอยู่ ไม่ได้พิสูจน์ว่าเครื่องผู้เล่นยังอยู่
// จึงต้องนับจาก "ข้อความจริงที่ไคลเอนต์ส่งมา" ซึ่ง proxy ปลอมให้ไม่ได้
// (ไคลเอนต์ส่ง {t:'ping'} ให้ทุก 20 วินาทีอยู่แล้ว)
const SILENT_LIMIT_MS = 90000;     // เผื่อเบราว์เซอร์หรี่ timer ตอนสลับแท็บ
const REAP_EVERY_MS = 15000;
const conns = new Set();

setInterval(() => {
  const now = Date.now();
  for (const conn of conns) {
    if (now - conn.lastSeen < SILENT_LIMIT_MS) continue;
    conns.delete(conn);
    codequest.onLeave(conn);         // เอาออกจากห้อง + โอนสิทธิ์เจ้าของห้อง
    try { conn.ws.terminate(); } catch (e) {}
  }
  // ping ระดับโปรโตคอลยังมีประโยชน์ตรงกันไม่ให้ proxy ตัดสายที่เงียบทิ้ง
  for (const ws of wss.clients) { try { ws.ping(); } catch (e) {} }
}, REAP_EVERY_MS).unref?.();

let seq = 0;
wss.on('connection', (ws) => {
  const conn = { id: 'p' + (++seq) + Date.now().toString(36).slice(-4), ws, room: null, lastSeen: Date.now() };
  conns.add(conn);
  ws.on('message', (raw) => {
    conn.lastSeen = Date.now();
    let data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    try {
      codequest.handleMessage(data, conn, ws);
    } catch (err) {
      console.error('[cq] error:', err);
      if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'error', msg: 'เซิร์ฟเวอร์มีปัญหา ลองใหม่อีกครั้ง' }));
    }
  });
  const gone = () => { conns.delete(conn); codequest.onLeave(conn); };
  ws.on('close', gone);
  ws.on('error', gone);
});

accounts.init().then(() => {
  server.listen(PORT, () => {
    console.log(`CodeQuest Universe server running at http://localhost:${PORT}`);
  });
});
