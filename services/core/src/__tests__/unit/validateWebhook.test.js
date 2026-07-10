const { webhookSchema } = require('../../middleware/validateWebhook');

const basePayload = () => ({
  event_type: 'appointment_cancelled',
  source_system_id: 'clinica-demo',
  return_url: 'https://clinica-demo.cl/webhook/respuesta',
  cancellation: {
    appointment_id: 'apt-001',
    cancelled_at: '2026-07-10T15:00:00.000Z',
    slot: {
      date: '2026-07-11',
      start_time: '09:00',
      end_time: '09:30',
      doctor_name: 'Dra. Pérez',
      specialty: 'Odontología',
      location: 'Sucursal Centro',
      latitud: -33.4489,
      longitud: -70.6693
    },
    cancelled_patient: {
      patient_id: 'pac-999',
      display_name: 'Paciente Cancelado'
    }
  },
  waitlist: [
    {
      patient_id: 'pac-001',
      display_name: 'Juan Pérez',
      phone: '+56912345678',
      metrics: { attendance_history: 0.8, urgencia: 0.5 }
    }
  ]
});

describe('validateWebhook - webhookSchema', () => {
  test('acepta un payload completo y válido', () => {
    const result = webhookSchema.safeParse(basePayload());
    expect(result.success).toBe(true);
  });

  test('acepta metricas dinámicas arbitrarias (record de números)', () => {
    const payload = basePayload();
    payload.waitlist[0].metrics = { tamano_grupo: 3, puntualidad: 0.9, cualquier_otra: 1.2 };
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  test('rechaza event_type distinto de appointment_cancelled', () => {
    const payload = basePayload();
    payload.event_type = 'appointment_created';
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  test('rechaza waitlist vacía', () => {
    const payload = basePayload();
    payload.waitlist = [];
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  test('rechaza teléfono que no cumple formato +569XXXXXXXX', () => {
    const payload = basePayload();
    payload.waitlist[0].phone = '+56212345678'; // falta el 9
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  test('rechaza teléfono con menos de 8 dígitos tras +569', () => {
    const payload = basePayload();
    payload.waitlist[0].phone = '+56912345';
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  test('rechaza fecha de slot con formato inválido', () => {
    const payload = basePayload();
    payload.cancellation.slot.date = '11-07-2026';
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  test('rechaza hora de slot con formato inválido', () => {
    const payload = basePayload();
    payload.cancellation.slot.start_time = '9:00';
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  test('rechaza return_url que no sea una URL válida', () => {
    const payload = basePayload();
    payload.return_url = 'no-es-una-url';
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  test('return_url es opcional', () => {
    const payload = basePayload();
    delete payload.return_url;
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  test('metrics por defecto es {} si no se envía', () => {
    const payload = basePayload();
    delete payload.waitlist[0].metrics;
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(true);
    expect(result.data.waitlist[0].metrics).toEqual({});
  });

  test('latitud/longitud son opcionales y nullable', () => {
    const payload = basePayload();
    payload.waitlist[0].latitud = null;
    payload.waitlist[0].longitud = null;
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  test('rechaza patient_id vacío', () => {
    const payload = basePayload();
    payload.waitlist[0].patient_id = '';
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  test('rechaza si falta appointment_id en cancellation', () => {
    const payload = basePayload();
    delete payload.cancellation.appointment_id;
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  test('rechaza email inválido cuando se envía', () => {
    const payload = basePayload();
    payload.waitlist[0].email = 'no-es-un-correo';
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  test('acepta email válido cuando se envía', () => {
    const payload = basePayload();
    payload.waitlist[0].email = 'juan.perez@example.com';
    const result = webhookSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
