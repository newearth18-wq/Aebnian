const express = require('express');
const {verifyTeacher} = require('./supabase');
const router = express.Router();
const MAX_BYTES = 10 * 1024 * 1024;

function googleSheetExport(source) {
  let url;
  try { url=new URL(source); } catch { throw new Error('วางลิงก์ Google Sheets ที่ถูกต้อง'); }
  if(url.protocol!=='https:' || url.hostname!=='docs.google.com' || url.username || url.password || url.port)
    throw new Error('รองรับลิงก์ https://docs.google.com/spreadsheets/ เท่านั้น');
  const match=url.pathname.match(/^\/spreadsheets\/d\/(e\/)?([A-Za-z0-9_-]+)(?:\/|$)/);
  if(!match)throw new Error('ลิงก์นี้ไม่ใช่ Google Sheets');
  const hash=new URLSearchParams(url.hash.slice(1));
  const gid=url.searchParams.get('gid') || hash.get('gid') || '0';
  if(!/^\d{1,15}$/.test(gid))throw new Error('หมายเลขแท็บชีตไม่ถูกต้อง');
  return match[1]
    ? `https://docs.google.com/spreadsheets/d/e/${match[2]}/pub?output=csv&gid=${gid}`
    : `https://docs.google.com/spreadsheets/d/${match[2]}/export?format=csv&gid=${gid}`;
}

async function fetchSheetCsv(source, request=fetch) {
  let url=googleSheetExport(source);
  const signal=AbortSignal.timeout(15000);
  for(let n=0;n<5;n++) {
    const response=await request(url,{redirect:'manual',signal});
    if([301,302,303,307,308].includes(response.status)) {
      const location=response.headers.get('location');
      if(!location)throw new Error('Google ไม่ส่งไฟล์ CSV กลับมา');
      const next=new URL(location,url);
      const allowed=next.hostname==='docs.google.com'||/^doc-[a-z0-9-]+-sheets\.googleusercontent\.com$/.test(next.hostname);
      if(next.protocol!=='https:'||!allowed||next.username||next.password||next.port)
        throw new Error('เปิดอ่านชีตนี้ไม่ได้ หากเป็นชีตส่วนตัว ให้ดาวน์โหลดเป็น CSV หรือ Excel แล้วนำเข้าไฟล์แทน');
      url=next.href;continue;
    }
    if(!response.ok)throw new Error('เปิดอ่านชีตนี้ไม่ได้ กรุณาตรวจลิงก์และสิทธิ์อ่าน หรือดาวน์โหลดเป็น CSV / Excel แล้วนำเข้าไฟล์');
    if(/html/i.test(response.headers.get('content-type')||''))throw new Error('ชีตนี้ยังไม่เปิดให้อ่านผ่านลิงก์ ใช้ไฟล์ CSV / Excel แทนได้โดยไม่ต้องเปลี่ยนสิทธิ์แชร์');
    if(Number(response.headers.get('content-length')||0)>MAX_BYTES)throw new Error('ชีตมีขนาดเกิน 10 MB กรุณาแบ่งไฟล์');
    const reader=response.body.getReader();let size=0;const chunks=[];
    try {
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES)throw new Error('ชีตมีขนาดเกิน 10 MB กรุณาแบ่งไฟล์');chunks.push(value);}
    } finally {await reader.cancel().catch(()=>{});}
    return Buffer.concat(chunks).toString('utf8');
  }
  throw new Error('Google เปลี่ยนเส้นทางหลายครั้งเกินไป กรุณาดาวน์โหลดเป็น CSV / Excel');
}

router.post('/google-sheet', async (req,res) => {
  res.set('Cache-Control','no-store');
  try {
    const token=String(req.headers.authorization||'').match(/^Bearer (.+)$/i)?.[1];
    if(!await verifyTeacher(token))return res.status(401).json({error:'กรุณาเข้าสู่ระบบครูก่อนนำเข้าชีต'});
    if(typeof req.body?.url!=='string'||req.body.url.length>3000)return res.status(400).json({error:'วางลิงก์ Google Sheets ที่ถูกต้อง'});
    const csv=await fetchSheetCsv(req.body.url);
    res.json({csv});
  } catch(error) {
    const message=error.name==='TimeoutError'||error.name==='AbortError'
      ? 'รอ Google นานเกินไป กรุณาลองใหม่ หรือใช้ไฟล์ CSV / Excel'
      : error.message==='fetch failed' ? 'เชื่อมต่อชีตไม่สำเร็จ กรุณาลองใหม่' : error.message;
    res.status(400).json({error:message});
  }
});

module.exports={router,googleSheetExport,fetchSheetCsv};
