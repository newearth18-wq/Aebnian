# Deploy เกมแอบเนียน

## ฐานข้อมูล

โปรเจกต์ Supabase `Aebnian Classroom Game` ได้รับ migration ทั้งสามไฟล์ใน `supabase/migrations/` แล้ว หากใช้โปรเจกต์ใหม่ ให้รันไฟล์ตามลำดับและเปลี่ยน URL/publishable key ใน `supabase-public.json` และ `client/config.js` ให้ตรงกัน

ตั้งค่าอีเมลผู้ส่งและ redirect URL ของ Supabase Auth ให้ตรงกับโดเมนจริงก่อนให้ครูสมัครบัญชี บัญชีใหม่อาจต้องกดยืนยันอีเมลก่อนล็อกอิน

## Render

Blueprint ใน `render.yaml` มี service `aeb-nian` ที่รัน `server/server.js` และ service `codequest-universe` แยกกัน ไฟล์เกมใช้ `client/` ส่วนข้อมูลข้อสอบใช้ Supabase จึงไม่หายเมื่อ Render รีสตาร์ท

หากต้องการให้ `https://aeb-nian.onrender.com/` เปลี่ยนตามโค้ดนี้ บริการ Render เดิมต้องเชื่อมกับ repo/branch ที่มี commit นี้ หรือ deploy จาก repo นั้นด้วยตนเอง การอัปเดตโค้ดใน repo อีกแห่งเพียงอย่างเดียวไม่เปลี่ยนบริการ Render ที่ยังเชื่อมกับ `supakitpo-boop/meccha-chameleon-game` ซึ่งเป็น private

หลัง deploy ตรวจว่า:

1. `/api/questions/sets` มีชุดตัวอย่างและชุดที่ครูเผยแพร่
2. `/admin` ให้ล็อกอินก่อนแก้ไขข้อสอบ
3. นักเรียนสร้างห้อง เลือกชุดคำถาม และตอบแล้วคะแนนเพิ่ม

`supabase-public.json` มีเพียง publishable key ห้ามเพิ่ม database password หรือ service role key ลง GitHub
