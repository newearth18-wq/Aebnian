const $ = id => document.getElementById(id);
const config = window.AEBNIAN_CONFIG;
const db = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
let packs = [];
let editingId = null;

function message(text) { $('message').textContent = text; }

async function showSession() {
  const { data: { user }, error } = await db.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') message(window.aebnianAuthError(error));
  $('authPanel').classList.toggle('hidden', !!user);
  $('editorPanel').classList.toggle('hidden', !user);
  if (user) {
    $('identity').textContent = user.email || 'บัญชีครู';
    await loadPacks(user.id);
  }
}

async function loadPacks(ownerId) {
  const { data, error } = await db.from('aeb_quiz_packs')
    .select('id,title,description,is_published,aeb_quiz_questions(id,prompt,options,correct_option,explanation,position)')
    .eq('owner_id', ownerId).order('updated_at', { ascending: false });
  if (error) return message(error.message);
  packs = data || [];
  const list = $('packList');
  list.replaceChildren();
  for (const pack of packs) {
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.toggle('active', pack.id === editingId);
    const title = document.createElement('strong');
    title.textContent = pack.title;
    const detail = document.createElement('small');
    detail.textContent = `${pack.aeb_quiz_questions.length} ข้อ · ${pack.is_published ? 'เผยแพร่แล้ว · เลือกเล่นได้' : 'ฉบับร่าง · ยังไม่แสดงในเกม'}`;
    button.append(title, detail);
    button.onclick = () => editPack(pack);
    list.appendChild(button);
  }
  if (editingId) {
    const selected = packs.find(pack => pack.id === editingId);
    if (selected) editPack(selected);
  } else if (!packs.length) editPack(null);
}

function editPack(pack) {
  editingId = pack?.id || null;
  $('packTitle').value = pack?.title || '';
  $('packDescription').value = pack?.description || '';
  $('packPublished').checked = !!pack?.is_published;
  $('questionEditor').replaceChildren();
  const questions = [...(pack?.aeb_quiz_questions || [])].sort((a, b) => a.position - b.position);
  for (const question of questions) addQuestion(question);
  if (!questions.length) addQuestion();
  [...$('packList').children].forEach((button, index) =>
    button.classList.toggle('active', packs[index]?.id === editingId));
  message('');
}

function addQuestion(question = null) {
  const row = document.createElement('div');
  row.className = 'questionRow';
  row.innerHTML = `
    <div class="questionHead"><b>คำถาม</b><button class="remove" type="button">ลบข้อนี้</button></div>
    <input class="prompt" placeholder="พิมพ์คำถาม" maxlength="1000" required>
    <div class="choices">
      <input class="choice" placeholder="ตัวเลือก A" required>
      <input class="choice" placeholder="ตัวเลือก B" required>
      <input class="choice" placeholder="ตัวเลือก C" required>
      <input class="choice" placeholder="ตัวเลือก D" required>
    </div>
    <label>คำตอบที่ถูก<select class="correct"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></label>
    <input class="explanation" placeholder="คำอธิบายเฉลย (ถ้ามี)">`;
  row.querySelector('.prompt').value = question?.prompt || '';
  row.querySelectorAll('.choice').forEach((input, index) => input.value = question?.options?.[index] || '');
  row.querySelector('.correct').value = String(question?.correct_option ?? 0);
  row.querySelector('.explanation').value = question?.explanation || '';
  row.querySelector('.remove').onclick = () => row.remove();
  $('questionEditor').appendChild(row);
}

async function savePack(event) {
  event.preventDefault();
  const rows = [...$('questionEditor').querySelectorAll('.questionRow')];
  if (!rows.length) return message('เพิ่มคำถามอย่างน้อย 1 ข้อ');
  const questions = rows.map((row, position) => ({
    prompt: row.querySelector('.prompt').value.trim(),
    options: [...row.querySelectorAll('.choice')].map(input => input.value.trim()),
    correct_option: Number(row.querySelector('.correct').value),
    explanation: row.querySelector('.explanation').value.trim(),
    position
  }));
  if (questions.some(question => !question.prompt || question.options.some(option => !option)))
    return message('กรอกคำถามและตัวเลือกทั้ง 4 ให้ครบ');
  message('กำลังบันทึก…');
  const { data, error } = await db.rpc('aeb_save_quiz_pack', {
    p_id: editingId,
    p_title: $('packTitle').value.trim(),
    p_description: $('packDescription').value.trim(),
    p_published: $('packPublished').checked,
    p_questions: questions
  });
  if (error) return message(error.message);
  editingId = data;
  const { data: { user } } = await db.auth.getUser();
  await loadPacks(user.id);
  message($('packPublished').checked
    ? 'เผยแพร่แล้ว เปิดตัวเลือกชุดข้อสอบในหน้าสร้างห้องเพื่อเลือกเล่นได้'
    : 'บันทึกเป็นฉบับร่างแล้ว ชุดนี้ยังไม่แสดงในหน้าสร้างห้อง');
}

let authBusy = false;
function setAuthBusy(busy) {
  authBusy = busy;
  $('loginForm').querySelectorAll('button').forEach(button => button.disabled = busy);
}

$('loginForm').onsubmit = async event => {
  event.preventDefault();
  if (authBusy) return;
  setAuthBusy(true);
  message('กำลังเข้าสู่ระบบ…');
  try {
    const { error } = await db.auth.signInWithPassword({
      email: $('email').value.trim(), password: $('password').value
    });
    if (error) throw error;
    $('password').value = '';
    await showSession();
    message('เข้าสู่ระบบแล้ว');
  } catch (error) {
    message(window.aebnianAuthError(error));
  } finally {
    setAuthBusy(false);
  }
};
$('signup').onclick = async () => {
  if (authBusy || !$('loginForm').reportValidity()) return;
  const email = $('email').value.trim(), password = $('password').value;
  setAuthBusy(true);
  message('กำลังสมัครบัญชีครู…');
  try {
    const { data, error } = await db.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/admin` }
    });
    if (error) throw error;
    $('password').value = '';
    if (data.session) {
      await showSession();
      message('สมัครบัญชีครูและเข้าสู่ระบบแล้ว');
    } else {
      message('ส่งคำขอสมัครแล้ว กรุณาตรวจกล่องจดหมายและสแปมเพื่อยืนยันอีเมล หากมีบัญชีอยู่แล้วให้เข้าสู่ระบบ');
    }
  } catch (error) {
    message(window.aebnianAuthError(error));
  } finally {
    setAuthBusy(false);
  }
};
$('logout').onclick = async () => { await db.auth.signOut(); editingId = null; await showSession(); };
$('newPack').onclick = () => editPack(null);
$('addQuestion').onclick = () => addQuestion();
$('packForm').onsubmit = savePack;
db.auth.onAuthStateChange(() => { setTimeout(showSession, 0); });
showSession();
