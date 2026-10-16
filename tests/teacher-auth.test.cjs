const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function page(authOverrides = {}) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', disabled: false,
      classList: { toggle() {} },
      reportValidity: () => true,
      querySelectorAll: () => [get('loginButton'), get('signup')]
    });
    return elements.get(id);
  };
  const auth = {
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange() {}, ...authOverrides
  };
  const window = {
    AEBNIAN_CONFIG: {}, location: { origin: 'https://aebnian-classroom-game.onrender.com' },
    supabase: { createClient: () => ({ auth }) }
  };
  const context = vm.createContext({ window, document: { getElementById: get }, setTimeout });
  for (const name of ['auth-errors.js', 'admin.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../client', name), 'utf8'), context);
  get('email').value = 'teacher@example.test';
  get('password').value = 'test-only-password';
  return { get, window };
}

test('signup honors form validation before calling Auth', async () => {
  let calls = 0;
  const { get } = page({ signUp: async () => { calls++; } });
  get('loginForm').reportValidity = () => false;
  await get('signup').onclick();
  assert.equal(calls, 0);
});

test('pending signup cannot be submitted twice and buttons recover after a rejected request', async () => {
  let rejectRequest, calls = 0;
  const { get } = page({ signUp: () => {
    calls++;
    return new Promise((resolve, reject) => { rejectRequest = reject; });
  } });
  const first = get('signup').onclick();
  assert.equal(get('signup').disabled, true);
  await get('signup').onclick();
  assert.equal(calls, 1);
  rejectRequest(new TypeError('Failed to fetch'));
  await first;
  assert.match(get('message').textContent, /เชื่อมต่อระบบบัญชีครูไม่ได้/);
  assert.equal(get('signup').disabled, false);
  assert.equal(get('loginButton').disabled, false);
});

test('signup without a session explains email confirmation and returns to the correct website', async () => {
  let input;
  const { get } = page({ signUp: async value => {
    input = value;
    return { data: { session: null }, error: null };
  } });
  await get('signup').onclick();
  assert.equal(input.options.emailRedirectTo, 'https://aebnian-classroom-game.onrender.com/admin');
  assert.match(get('message').textContent, /ยืนยันอีเมล/);
  assert.equal(get('password').value, '');
  assert.equal(get('signup').disabled, false);
});

test('SMTP rejection has a useful Thai message and signup remains available for retry', async () => {
  const { get } = page({ signUp: async () => ({ data: null, error: {
    code: 'email_address_not_authorized', message: 'Email address not authorized'
  } }) });
  await get('signup').onclick();
  assert.match(get('message').textContent, /ยังส่งอีเมลยืนยัน/);
  assert.equal(get('signup').disabled, false);
});

test('obfuscated repeated signup does not claim an email was sent and explains existing credentials', async () => {
  const { get } = page({ signUp: async () => ({
    data: { session: null, user: { identities: [] } }, error: null
  }) });
  await get('signup').onclick();
  assert.doesNotMatch(get('message').textContent, /ส่งคำขอสมัครแล้ว|ส่งอีเมลแล้ว/);
  assert.match(get('message').textContent, /รหัสผ่านเดิม/);
  assert.match(get('message').textContent, /ไม่ส่งอีเมลยืนยันใหม่/);
});

test('login reports returned Auth errors and recovers from network rejection', async () => {
  let calls = 0;
  const { get } = page({ signInWithPassword: async () => {
    if (calls++ === 0) return { error: { code: 'invalid_credentials' } };
    throw new TypeError('Failed to fetch');
  } });
  await get('loginForm').onsubmit({ preventDefault() {} });
  assert.match(get('message').textContent, /อีเมลหรือรหัสผ่านไม่ถูกต้อง/);
  await get('loginForm').onsubmit({ preventDefault() {} });
  assert.match(get('message').textContent, /เชื่อมต่อระบบบัญชีครูไม่ได้/);
  assert.equal(get('loginButton').disabled, false);
});
