const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function page({ hash = '', authOverrides = {} } = {}) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', disabled: false,
      hidden: ['resetForm', 'donePanel'].includes(id), reportValidity: () => true
    });
    return elements.get(id);
  };
  let clientOptions, cleanedUrl, updateCalls = 0, resetCalls = 0, signoutOptions;
  const auth = {
    getSession: async () => ({ data: { session: { user: { id: 'test-user' } } }, error: null }),
    getUser: async () => ({ data: { user: { id: 'test-user', email: 'teacher@example.test' } }, error: null }),
    updateUser: async () => { updateCalls++; return { error: null }; },
    resetPasswordForEmail: async () => { resetCalls++; return { error: null }; },
    signOut: async options => { signoutOptions = options; return { error: null }; },
    ...authOverrides
  };
  const window = {
    AEBNIAN_CONFIG: {}, location: { hash, origin: 'https://school.example.test', pathname: '/reset-password' },
    history: { replaceState: (state, unused, url) => { cleanedUrl = url; } },
    supabase: { createClient: (url, key, options) => { clientOptions = options; return { auth }; } }
  };
  const context = vm.createContext({ window, document: { getElementById: get }, URLSearchParams });
  for (const name of ['auth-errors.js', 'reset-password.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../client', name), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return { get, auth, state: () => ({ clientOptions, cleanedUrl, updateCalls, resetCalls, signoutOptions }) };
}

const submit = () => ({ preventDefault() {} });

test('an existing game session without a recovery link cannot change passwords', async () => {
  const view = await page();
  await view.get('resetForm').onsubmit(submit());
  assert.equal(view.state().updateCalls, 0);
  assert.equal(view.get('resetForm').hidden, true);
  assert.equal(view.state().clientOptions.auth.persistSession, false);
  assert.equal(view.state().clientOptions.auth.storageKey, 'aebnian-password-recovery');
});

test('forged recovery URL without an Auth session stays closed', async () => {
  const view = await page({ hash: '#type=recovery', authOverrides: {
    getSession: async () => ({ data: { session: null }, error: null })
  } });
  assert.equal(view.get('resetForm').hidden, true);
  assert.equal(view.get('requestForm').hidden, false);
  assert.match(view.get('message').textContent, /ลิงก์หมดอายุ/);
  assert.equal(view.state().cleanedUrl, '/reset-password');
});

test('expired links and rejected identity validation offer a fresh request', async () => {
  for (const options of [
    { hash: '#error=access_denied&error_code=otp_expired' },
    { hash: '#type=recovery', authOverrides: { getUser: async () => ({ data: { user: null }, error: { code: 'bad_jwt' } }) } }
  ]) {
    const view = await page(options);
    assert.equal(view.get('resetForm').hidden, true);
    assert.equal(view.get('requestForm').hidden, false);
  }
});

test('validated recovery rejects mismatches and saves once, clearing passwords and only its own session', async () => {
  const view = await page({ hash: '#type=recovery' });
  assert.equal(view.get('resetForm').hidden, false);
  view.get('newPassword').value = 'long-test-only-password';
  view.get('confirmPassword').value = 'different-test-password';
  await view.get('resetForm').onsubmit(submit());
  assert.equal(view.state().updateCalls, 0);
  assert.match(view.get('message').textContent, /ไม่ตรงกัน/);
  view.get('confirmPassword').value = 'long-test-only-password';
  await view.get('resetForm').onsubmit(submit());
  assert.equal(view.state().updateCalls, 1);
  assert.equal(view.get('newPassword').value, '');
  assert.equal(view.get('confirmPassword').value, '');
  assert.equal(view.get('donePanel').hidden, false);
  assert.equal(view.state().signoutOptions.scope, 'local');
  await view.get('resetForm').onsubmit(submit());
  assert.equal(view.state().updateCalls, 1);
});

test('email requests use the recovery page and do not reveal whether an account exists', async () => {
  let requested;
  const view = await page({ authOverrides: { resetPasswordForEmail: async (email, options) => {
    requested = { email, options }; return { error: null };
  } } });
  view.get('recoveryEmail').value = ' teacher@example.test ';
  await view.get('requestForm').onsubmit(submit());
  assert.equal(requested.email, 'teacher@example.test');
  assert.equal(requested.options.redirectTo, 'https://school.example.test/reset-password');
  assert.match(view.get('message').textContent, /หากอีเมลนี้มีบัญชี/);
  assert.equal(view.get('sendRecovery').disabled, false);
});

test('a pending email request cannot be duplicated and network failure allows retry', async () => {
  let rejectRequest, calls = 0;
  const view = await page({ authOverrides: { resetPasswordForEmail: () => {
    calls++;
    return new Promise((resolve, reject) => { rejectRequest = reject; });
  } } });
  const first = view.get('requestForm').onsubmit(submit());
  await view.get('requestForm').onsubmit(submit());
  assert.equal(calls, 1);
  assert.equal(view.get('sendRecovery').disabled, true);
  rejectRequest(new TypeError('Failed to fetch'));
  await first;
  assert.equal(view.get('sendRecovery').disabled, false);
  assert.match(view.get('message').textContent, /เชื่อมต่อระบบบัญชีครูไม่ได้/);
});

test('a failed password update keeps fields available and does not show success', async () => {
  const view = await page({ hash: '#type=recovery', authOverrides: {
    updateUser: async () => ({ error: { code: 'same_password' } })
  } });
  view.get('newPassword').value = view.get('confirmPassword').value = 'long-test-only-password';
  await view.get('resetForm').onsubmit(submit());
  assert.equal(view.get('donePanel').hidden, true);
  assert.equal(view.get('savePassword').disabled, false);
  assert.match(view.get('message').textContent, /ต่างจากรหัสผ่านเดิม/);
});

test('a session that expires while entering a password returns to the request form', async () => {
  const view = await page({ hash: '#type=recovery', authOverrides: {
    updateUser: async () => ({ error: { code: 'session_expired' } })
  } });
  view.get('newPassword').value = view.get('confirmPassword').value = 'long-test-only-password';
  await view.get('resetForm').onsubmit(submit());
  assert.equal(view.get('resetForm').hidden, true);
  assert.equal(view.get('requestForm').hidden, false);
  assert.equal(view.get('donePanel').hidden, true);
});
