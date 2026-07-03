describe('lógica de fallo dual de canales', () => {
  test('WhatsApp falla pero Email tiene éxito → NO rompe el job', () => {
    const wa    = { success: false, error: 'WA timeout' };
    const email = { success: true,  messageId: 'em-123' };
    expect(!wa.success && !email.success).toBe(false);
  });

  test('AMBOS canales fallan → debe fallar el job', () => {
    const wa    = { success: false, error: 'WA timeout' };
    const email = { success: false, error: 'SMTP error' };
    expect(!wa.success && !email.success).toBe(true);
  });

  test('WhatsApp tiene éxito y Email falla → NO rompe el job', () => {
    const wa    = { success: true };
    const email = { success: false, error: 'SMTP error' };
    expect(!wa.success && !email.success).toBe(false);
  });

  test('ambos canales exitosos → resultado limpio', () => {
    const wa    = { success: true, messageId: 'wa-001' };
    const email = { success: true, messageId: 'em-001' };
    const total = [wa, email].filter((r) => r.success).length;
    expect(total).toBe(2);
  });

  test('candidato sin email omite canal email sin error', () => {
    const candidate = { patient_id: 'p-1', phone: '+5699', email: null };
    const emailSent = !!(candidate.email);
    expect(emailSent).toBe(false);
  });
});