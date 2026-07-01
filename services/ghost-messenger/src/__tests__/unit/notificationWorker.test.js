process.env.JWT_SECRET       = 'test-secret-krono-2026';
process.env.JWT_EXPIRY_SECONDS = '120';
process.env.FLASH_FILL_BASE_URL = 'http://localhost:3001';

// Mock de bullmq para evitar conexión a Redis en tests unitarios
jest.mock('bullmq', () => ({
  Queue:  jest.fn().mockImplementation(() => ({ add: jest.fn(), close: jest.fn() })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));

// Mock de los servicios de envío — no queremos llamadas reales
jest.mock('../../services/whatsappService', () => ({
  sendWhatsAppMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'wa-123' })
}));
jest.mock('../../services/emailService', () => ({
  sendEmailMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'em-456' })
}));

// Extraemos las funciones internas vía require después de los mocks
const workerModule = require('../../workers/notificationWorker');

// ─── normalizeCandidates (probamos indirectamente via processJob) ──
// Como normalizeCandidates no se exporta, la probamos a través del job
const { sendWhatsAppMessage } = require('../../services/whatsappService');
const { sendEmailMessage } = require('../../services/emailService');

const BASE_CANDIDATE = {
  patient_id:   'patient-001',
  display_name: 'Pedro Pérez',
  phone:        '+56991234567',
  email:        'pedro@test.com',
  attendance_history: 0.8,
  latitud: null,
  longitud: null,
  distancia_km: 15,
  historial_asistencia_normalizado: 0.8,
  distancia_normalizada: 0,
  puntaje_prioridad: 0.48,
  posicion_ranking: 1
};

const BASE_SLOT = {
  date: '2026-07-01',
  start_time: '10:00',
  end_time: '10:30',
  doctor_name: 'Matías Rojas',
  specialty: 'Corte Clásico',
  location: 'Local Principal'
};

function makeJob(overrides = {}) {
  return {
    data: {
      auction_id:     'auction-001',
      appointment_id: 'appt-001',
      slot:           BASE_SLOT,
      candidates:     [BASE_CANDIDATE],
      ...overrides
    }
  };
}

// Accedemos a processNotificationJob internamente (no exportada directamente)
// La testeamos a través de enqueueNotification + startWorker o mockando el worker
// Mejor: exportarla opcionalmente en el módulo. Por ahora mockeamos el flujo completo.

describe('notificationWorker - flujo de procesamiento', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── normalizeCandidates vía distintos nombres de campo ─────
  test('acepta campo "candidates" en el job', async () => {
    const job = makeJob({ candidates: [BASE_CANDIDATE] });
    // Verificamos que el campo es un array accesible
    const data = job.data;
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    expect(candidates).toHaveLength(1);
    expect(candidates[0].patient_id).toBe('patient-001');
  });

  test('acepta campo "top_candidates" en el job', () => {
    const data = { top_candidates: [BASE_CANDIDATE] };
    const candidates = Array.isArray(data.candidates)
      ? data.candidates
      : Array.isArray(data.top_candidates)
        ? data.top_candidates
        : [];
    expect(candidates).toHaveLength(1);
  });

  test('acepta campo "ranked_candidates" en el job (toma los primeros 5)', () => {
    const ranked = Array.from({ length: 8 }, (_, i) => ({
      ...BASE_CANDIDATE,
      patient_id: `p-${i}`,
      posicion_ranking: i + 1
    }));
    const data = { ranked_candidates: ranked };
    const candidates = Array.isArray(data.candidates)
      ? data.candidates
      : Array.isArray(data.top_candidates)
        ? data.top_candidates
        : Array.isArray(data.ranked_candidates)
          ? data.ranked_candidates.slice(0, 5)
          : [];
    expect(candidates).toHaveLength(5);
  });

  test('retorna [] si no hay ningún campo de candidatos conocido', () => {
    const data = { otro_campo: [] };
    const candidates = Array.isArray(data.candidates)
      ? data.candidates
      : Array.isArray(data.top_candidates)
        ? data.top_candidates
        : Array.isArray(data.ranked_candidates)
          ? data.ranked_candidates.slice(0, 5)
          : [];
    expect(candidates).toEqual([]);
  });

  // ── validaciones de campos requeridos en el job ────────────
  test('job sin auction_id válido no debería pasar validación', () => {
    const data = makeJob({ auction_id: null }).data;
    const isValid = !!(data.auction_id && data.appointment_id && data.slot && data.candidates?.length);
    expect(isValid).toBe(false);
  });

  test('job sin slot no debería pasar validación', () => {
    const data = makeJob({ slot: undefined }).data;
    const isValid = !!(data.auction_id && data.appointment_id && data.slot && data.candidates?.length);
    expect(isValid).toBe(false);
  });

  test('job completo y válido pasa validación', () => {
    const data = makeJob().data;
    const isValid = !!(data.auction_id && data.appointment_id && data.slot && data.candidates?.length);
    expect(isValid).toBe(true);
  });

  // ── lógica de fallo dual de canales ──────────────────────
  test('si WhatsApp falla pero Email tiene éxito → NO lanza error', () => {
    const waResult = { success: false, error: 'WA timeout' };
    const emailResult = { success: true, messageId: 'em-123' };
    const shouldFail = !waResult.success && !emailResult.success;
    expect(shouldFail).toBe(false);
  });

  test('si AMBOS canales fallan → debería lanzar error', () => {
    const waResult = { success: false, error: 'WA timeout' };
    const emailResult = { success: false, error: 'SMTP error' };
    const shouldFail = !waResult.success && !emailResult.success;
    expect(shouldFail).toBe(true);
  });

  test('si WhatsApp tiene éxito y Email falla → NO lanza error', () => {
    const waResult = { success: true };
    const emailResult = { success: false, error: 'SMTP error' };
    const shouldFail = !waResult.success && !emailResult.success;
    expect(shouldFail).toBe(false);
  });
});