# Deploy เกมแอบเนียน

## ฐานข้อมูล

โปรเจกต์ Supabase `Aebnian Classroom Game` ได้รับ migration ทั้งสามไฟล์ใน `supabase/migrations/` แล้ว หากใช้โปรเจกต์ใหม่ ให้รันไฟล์ตามลำดับและเปลี่ยน URL/publishable key ใน `supabase-public.json` และ `client/config.js` ให้ตรงกัน

ตั้งค่าอีเมลผู้ส่งและ redirect URL ของ Supabase Auth ให้ตรงกับโดเมนจริงก่อนให้ครูสมัครบัญชี บัญชีใหม่อาจต้องกดยืนยันอีเมลก่อนล็อกอิน

## Render

Blueprint ใน `render.yaml` มี service `aeb-nian` ที่รัน `server/server.js` และ service `codequest-universe` แยกกัน ไฟล์เกมใช้ `client/` ส่วนข้อมูลข้อสอบใช้ Supabase จึงไม่หายเมื่อ Render รีสตาร์ท

หากต้องการให้ `https://aeb-nian.onrender.com/` เปลี่ยนตามโค้ดนี้ ใน Render Dashboard ให้เปิดบริการ `aeb-nian` → **Settings → Build → Source → Edit** แล้วเลือก repo `newearth18-wq/Aebnian` และ branch `feature/classroom-game-free-host` ตั้ง Root Directory เป็น `server`, Build Command เป็น `npm install`, Start Command เป็น `npm start` การเปลี่ยน source จะเริ่ม deploy ใหม่ ส่วนการอัปเดต repo อีกแห่งเพียงอย่างเดียวไม่เปลี่ยนบริการ Render ที่ยังเชื่อมกับ `supakitpo-boop/meccha-chameleon-game` ซึ่งเป็น private

ถ้า Render ไม่เริ่ม deploy เอง ให้เปิด **Deploys → Manual Deploy → Deploy latest commit** แล้วตรวจว่า commit ล่าสุดคือ `f22e5f0` หรือใหม่กว่า

ถ้าบริการยังรันจาก root ของ repo และใช้ `yarn start` โค้ดนี้มี `package.json` ที่ root ให้เริ่ม `server/server.js` ได้เช่นกัน ส่วนการตั้งค่าที่แนะนำยังเป็น Root Directory `server`, Build `npm install`, Start `npm start`

หลัง deploy ตรวจว่า:

1. `/api/questions/sets` มีชุดตัวอย่างและชุดที่ครูเผยแพร่
2. `/admin` ให้ล็อกอินก่อนแก้ไขข้อสอบ
3. นักเรียนสร้างห้อง เลือกชุดคำถาม และตอบแล้วคะแนนเพิ่ม

`supabase-public.json` มีเพียง publishable key ห้ามเพิ่ม database password หรือ service role key ลง GitHub
