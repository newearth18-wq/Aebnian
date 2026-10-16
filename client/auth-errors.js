window.aebnianAuthError = error => {
  const text = String(error?.message || error || '');
  if (error?.name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|load failed|fetch failed/i.test(text))
    return 'เชื่อมต่อระบบบัญชีครูไม่ได้ กรุณาลองใหม่ หากยังไม่ได้ให้ติดต่อผู้ดูแลเกม';
  const messages = {
    invalid_credentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    email_not_confirmed: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ โดยเปิดลิงก์ในอีเมลที่ได้รับ',
    signup_disabled: 'ระบบยังไม่เปิดรับสมัครบัญชีใหม่ กรุณาติดต่อผู้ดูแลเกม',
    email_address_not_authorized: 'ระบบยังส่งอีเมลยืนยันไปยังที่อยู่นี้ไม่ได้ กรุณาติดต่อผู้ดูแลเกม',
    over_email_send_rate_limit: 'ส่งอีเมลยืนยันครบจำนวนที่ระบบอนุญาตแล้ว กรุณารอสักครู่ก่อนลองใหม่',
    over_request_rate_limit: 'มีคำขอมากเกินไป กรุณารอสักครู่ก่อนลองใหม่',
    user_already_exists: 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณากดเข้าสู่ระบบ',
    email_exists: 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณากดเข้าสู่ระบบ'
  };
  return messages[error?.code] || text || 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่';
};
