// ============================================================================
// accounts.js — บัญชีผู้เล่นของ CodeQuest (ใช้เก็บความก้าวหน้าไว้ข้ามเครื่อง)
//
// ที่เก็บข้อมูลเลือกเองตามที่มี:
//   1. Postgres  — ถ้าตั้ง DATABASE_URL ไว้ (ทนทานจริง รอด deploy/restart)
//   2. ไฟล์ JSON — ถ้าไม่มี ใช้ได้ทันทีแต่หายเมื่อ Render ฟรีเทียร์รีสตาร์ท
//
// ฝั่งไคลเอนต์เก็บ localStorage เป็นหลักอยู่แล้ว ตัวนี้จึงเป็น "สำเนาสำรอง"
// ต่อให้ที่นี่หาย ผู้เล่นบนเครื่องเดิมก็ไม่เสียความก้าวหน้า
// ============================================================================
const fs = require('fs');
const path = require('path');

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // ตัดตัวที่อ่านสับสน
const FILE = process.env.CQ_ACCOUNTS_FILE || path.join(__dirname, 'accounts.json');
const MAX_BYTES = 64 * 1024;                             // กันคนยัดข้อมูลใหญ่เกินจำเป็น

let pg = null;
let ready = false;
let lastError = null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function init(){
  if(process.env.DATABASE_URL){
    const { Pool } = require('pg');
    pg = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,                          // Postgres แบบ serverless จำกัดจำนวน connection
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 15000,  // เผื่อฐานข้อมูลกำลังตื่นจากการพัก
    });
    // สำคัญมาก: ถ้าไม่ดัก error ของ client ที่ว่างอยู่ โปรเซสจะตายทั้งตัว
    // ตอนที่ Neon/Supabase พักตัวเองแล้วตัดการเชื่อมต่อทิ้ง
    pg.on('error', err => {
      lastError = err.message;
      console.error('[cq] Postgres pool error (ไม่ทำให้เซิร์ฟเวอร์ล่ม):', err.message);
    });

    // ฐานข้อมูลที่พักอยู่ต้องใช้เวลาตื่น ครั้งแรกจึงอาจล้มเหลว — ลองซ้ำก่อนยอมแพ้
    for(let attempt = 1; attempt <= 3; attempt++){
      try{
        await pg.query(`CREATE TABLE IF NOT EXISTS cq_accounts (
          code TEXT PRIMARY KEY,
          name TEXT,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
        lastError = null;
        console.log('[cq] บัญชี: ใช้ Postgres ✅ (ข้อมูลอยู่ถาวร)');
        ready = true;
        return;
      }catch(e){
        lastError = e.message;
        console.error(`[cq] ต่อ Postgres ไม่สำเร็จ (ครั้งที่ ${attempt}/3): ${e.message}`);
        if(attempt < 3) await sleep(attempt * 2000);
      }
    }
    try{ await pg.end(); }catch(e){}
    pg = null;
  }
  console.log('[cq] บัญชี: ใช้ไฟล์ ' + FILE + ' ⚠️ (จะหายเมื่อเซิร์ฟเวอร์รีสตาร์ทบนแพลนฟรี)');
  ready = true;
}

// ---- ที่เก็บแบบไฟล์ ----
let cache = null;
function readFile(){
  if(cache) return cache;
  try{ cache = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch(e){ cache = {}; }
  return cache;
}
let writeTimer = null;
function writeFileSoon(){
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try{ fs.writeFileSync(FILE, JSON.stringify(cache)); }
    catch(e){ console.error('[cq] เขียนไฟล์บัญชีไม่ได้:', e.message); }
  }, 400);
}

async function exists(code){
  if(pg){
    const r = await pg.query('SELECT 1 FROM cq_accounts WHERE code=$1', [code]);
    return r.rowCount > 0;
  }
  return !!readFile()[code];
}

async function newCode(){
  for(let i=0;i<60;i++){
    let c = '';
    for(let k=0;k<6;k++) c += CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)];
    if(!await exists(c)) return c;
  }
  throw new Error('สร้างรหัสไม่สำเร็จ');
}

function clean(data){
  const s = JSON.stringify(data || {});
  // ต้องนับเป็นไบต์จริง ไม่ใช่จำนวนตัวอักษร — ภาษาไทยตัวหนึ่งกิน 3 ไบต์
  if(Buffer.byteLength(s, 'utf8') > MAX_BYTES) throw new Error('ข้อมูลใหญ่เกินไป');
  return JSON.parse(s);
}

async function create(name, data){
  const code = await newCode();
  const payload = clean(data);
  const nm = String(name || 'ผู้เล่น').slice(0, 24);
  if(pg) await pg.query('INSERT INTO cq_accounts(code,name,data) VALUES($1,$2,$3)', [code, nm, payload]);
  else { readFile()[code] = { name:nm, data:payload, updated: Date.now() }; writeFileSoon(); }
  return code;
}

async function save(code, data){
  const c = String(code || '').toUpperCase();
  const payload = clean(data);
  const nm = String(payload.name || 'ผู้เล่น').slice(0, 24);
  if(pg){
    const r = await pg.query(
      'UPDATE cq_accounts SET data=$2, name=$3, updated_at=now() WHERE code=$1', [c, payload, nm]);
    if(!r.rowCount) throw new Error('ไม่พบบัญชีนี้');
  } else {
    const db = readFile();
    if(!db[c]) throw new Error('ไม่พบบัญชีนี้');
    db[c] = { name:nm, data:payload, updated: Date.now() };
    writeFileSoon();
  }
}

async function load(code){
  const c = String(code || '').toUpperCase();
  if(pg){
    const r = await pg.query('SELECT data FROM cq_accounts WHERE code=$1', [c]);
    if(!r.rowCount) throw new Error('ไม่พบบัญชีนี้');
    return r.rows[0].data;
  }
  const rec = readFile()[c];
  if(!rec) throw new Error('ไม่พบบัญชีนี้');
  return rec.data;
}

async function count(){
  if(pg){ const r = await pg.query('SELECT count(*)::int n FROM cq_accounts'); return r.rows[0].n; }
  return Object.keys(readFile()).length;
}

const durable = () => !!pg;
// บอกให้ชัดว่าเป็น "ยังไม่ได้ตั้ง DATABASE_URL" หรือ "ตั้งแล้วแต่ต่อไม่ได้"
// สองอย่างนี้แก้คนละวิธี ถ้าไม่แยกจะไล่หาสาเหตุไม่ถูก
const status = () => {
  const url = process.env.DATABASE_URL || '';
  let host;
  try { if(url) host = new URL(url).host; } catch(e) { host = '(รูปแบบ URL ไม่ถูกต้อง)'; }
  return {
    store: pg ? 'postgres' : 'file',
    durable: !!pg,
    hasDatabaseUrl: !!url,
    dbHost: host,                      // เฉพาะชื่อโฮสต์ ไม่มีรหัสผ่าน
    error: lastError || undefined,
    hint: pg ? undefined
        : !url ? 'ยังไม่ได้ตั้ง DATABASE_URL ใน Environment ของ service นี้'
        : 'ตั้ง DATABASE_URL แล้วแต่ต่อไม่ได้ ดูช่อง error',
  };
};

module.exports = { init, create, save, load, count, durable, status, ready: () => ready };
