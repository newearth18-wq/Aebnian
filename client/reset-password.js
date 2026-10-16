(() => {
  const $ = id => document.getElementById(id);
  // Capture the link type before Supabase consumes and removes the URL fragment.
  const params = new URLSearchParams(window.location.hash.slice(1));
  const recoveryLink = params.get('type') === 'recovery';
  const linkError = params.has('error') || params.has('error_code');
  const config = window.AEBNIAN_CONFIG;
  // Keep recovery separate from the teacher's game session. A normal logged-in
  // session must not unlock the reset form, and recovery tokens stay in memory.
  const db = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      storageKey: 'aebnian-password-recovery', persistSession: false,
      autoRefreshToken: false, detectSessionInUrl: true, flowType: 'implicit'
    }
  });
  const message = text => { $('message').textContent = text; };
  let recoveryReady = false;
  let saving = false;
  let requesting = false;
  const expiredMessage = 'ลิงก์หมดอายุ ถูกใช้แล้ว หรือใช้งานไม่ได้ กรุณาขอลิงก์ตั้งรหัสผ่านใหม่ด้านล่าง';

  $('requestForm').onsubmit = async event => {
    event.preventDefault();
    if (requesting || !$('requestForm').reportValidity()) return;
    requesting = true;
    $('sendRecovery').disabled = true;
    message('กำลังส่งคำขอ…');
    try {
      const { error } = await db.auth.resetPasswordForEmail($('recoveryEmail').value.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      message('หากอีเมลนี้มีบัญชีอยู่ คุณจะได้รับลิงก์ตั้งรหัสผ่านใหม่ กรุณาตรวจกล่องจดหมายและสแปม หากยังไม่พบให้รออย่างน้อย 1 นาทีก่อนขออีกครั้ง');
    } catch (error) {
      message(window.aebnianAuthError(error));
    } finally {
      requesting = false;
      $('sendRecovery').disabled = false;
    }
  };

  $('resetForm').onsubmit = async event => {
    event.preventDefault();
    if (saving) return;
    if (!recoveryReady) { message(expiredMessage); return; }
    if (!$('resetForm').reportValidity()) return;
    const password = $('newPassword').value;
    if (password.length < 8) { message('ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร'); return; }
    if (password !== $('confirmPassword').value) {
      message('รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      return;
    }
    saving = true;
    $('savePassword').disabled = true;
    message('กำลังบันทึกรหัสผ่านใหม่…');
    try {
      const { error } = await db.auth.updateUser({ password });
      if (error) throw error;
      recoveryReady = false;
      $('newPassword').value = '';
      $('confirmPassword').value = '';
      $('resetForm').hidden = true;
      $('donePanel').hidden = false;
      message('ตั้งรหัสผ่านใหม่แล้ว ใช้รหัสใหม่นี้เข้าสู่ระบบ Aebnian และ Coastal Quest ได้');
      // Release only this isolated recovery session. Saving succeeded even if
      // the network drops during cleanup; never ask the user to change it twice.
      try { await db.auth.signOut({ scope: 'local' }); } catch (_) {}
    } catch (error) {
      if (['session_not_found', 'session_expired', 'bad_jwt', 'otp_expired'].includes(error?.code)) {
        recoveryReady = false;
        $('resetForm').hidden = true;
        $('requestForm').hidden = false;
      }
      message(window.aebnianAuthError(error));
    } finally {
      saving = false;
      $('savePassword').disabled = false;
    }
  };

  async function initialize() {
    if (!recoveryLink && !linkError) return;
    $('requestForm').hidden = true;
    message('กำลังตรวจสอบลิงก์…');
    try {
      const { data, error } = await db.auth.getSession();
      if (linkError || error || !recoveryLink || !data.session) throw new Error(expiredMessage);
      // Validate with Auth before showing a password form, rather than trusting
      // an unverified token or URL flag alone.
      const userResult = await db.auth.getUser();
      if (userResult.error || !userResult.data?.user) throw new Error(expiredMessage);
      recoveryReady = true;
      $('recoveryIdentity').textContent = userResult.data.user.email || 'บัญชีครู';
      $('recoveryTitle').textContent = 'ตั้งรหัสผ่านใหม่';
      $('resetForm').hidden = false;
      message('ลิงก์ยืนยันแล้ว กรุณาตั้งรหัสผ่านใหม่');
    } catch (_) {
      $('requestForm').hidden = false;
      message(expiredMessage);
    } finally {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }
  initialize();
})();
