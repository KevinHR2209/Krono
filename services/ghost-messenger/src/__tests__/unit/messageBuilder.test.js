process.env.JWT_SECRET       = 'test-secret-krono-2026';
process.env.JWT_EXPIRY_SECONDS = '120';
process.env.FLASH_FILL_BASE_URL = 'http://localhost:3001';

const { buildMessage, buildConfirmLinkWithTokens } = require('../../services/messageBuilder');

const CANDIDATE = {
  patient_id:   'patient-001',
  display_name: 'María González',
  phone:        '+56991234567',
  email:        'maria@test.com'
};

const SLOT = {
  date:        '2026-07-01',
  start_time:  '10:00',
  end_time:    '10:30',
  doctor_name: 'Matías Rojas',
  specialty:   'Corte Clásico',
  location:    'Local Principal'
};

const CONFIRM_LINK = 'http://localhost:3001/api/v1/confirm/FAKE_TOKEN';

// ─── buildMessage ─────────────────────────────────────────────
describe('buildMessage', () => {
  test('incluye display_name del candidato', () => {
    const msg = buildMessage(CANDIDATE, SLOT, CONFIRM_LINK);
    expect(msg).toContain('María González');
  });

  test('incluye fecha del slot', () => {
    const msg = buildMessage(CANDIDATE, SLOT, CONFIRM_LINK);
    expect(msg).toContain('2026-07-01');
  });

  test('incluye hora de inicio y fin', () => {
    const msg = buildMessage(CANDIDATE, SLOT, CONFIRM_LINK);
    expect(msg).toContain('10:00');
    expect(msg).toContain('10:30');
  });

  test('incluye nombre del doctor', () => {
    const msg = buildMessage(CANDIDATE, SLOT, CONFIRM_LINK);
    expect(msg).toContain('Matías Rojas');
  });

  test('incluye especialidad', () => {
    const msg = buildMessage(CANDIDATE, SLOT, CONFIRM_LINK);
    expect(msg).toContain('Corte Clásico');
  });

  test('incluye ubicación', () => {
    const msg = buildMessage(CANDIDATE, SLOT, CONFIRM_LINK);
    expect(msg).toContain('Local Principal');
  });

  test('incluye el confirmLink', () => {
    const msg = buildMessage(CANDIDATE, SLOT, CONFIRM_LINK);
    expect(msg).toContain(CONFIRM_LINK);
  });

  test('no empieza ni termina con espacios/saltos en blanco (trim)', () => {
    const msg = buildMessage(CANDIDATE, SLOT, CONFIRM_LINK);
    expect(msg).toBe(msg.trim());
  });

  test('retorna string no vacío', () => {
    const msg = buildMessage(CANDIDATE, SLOT, CONFIRM_LINK);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(20);
  });
});

// ─── buildConfirmLinkWithTokens ───────────────────────────────
describe('buildConfirmLinkWithTokens', () => {
  test('retorna un string con la base URL', () => {
    const link = buildConfirmLinkWithTokens('patient-001', 'auction-001', 'appt-001');
    expect(link).toContain('http://localhost:3001');
  });

  test('contiene el segmento /api/v1/confirm/', () => {
    const link = buildConfirmLinkWithTokens('patient-001', 'auction-001', 'appt-001');
    expect(link).toContain('/api/v1/confirm/');
  });

  test('el token al final del link es decodificable como JWT', () => {
    const jwt = require('jsonwebtoken');
    const link = buildConfirmLinkWithTokens('patient-001', 'auction-001', 'appt-001');
    const token = link.split('/api/v1/confirm/')[1];
    const decoded = jwt.decode(token);
    expect(decoded).not.toBeNull();
    expect(decoded.patient_id).toBe('patient-001');
    expect(decoded.auction_id).toBe('auction-001');
    expect(decoded.appointment_id).toBe('appt-001');
  });

  test('usa FLASH_FILL_BASE_URL del entorno', () => {
    process.env.FLASH_FILL_BASE_URL = 'https://krono.app';
    // Necesitamos resetear el módulo para que tome el nuevo env
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret-krono-2026';
    const { buildConfirmLinkWithTokens: buildLink } = require('../../services/messageBuilder');
    const link = buildLink('p', 'a', 'ap');
    expect(link).toContain('https://krono.app');
    // Restaurar
    process.env.FLASH_FILL_BASE_URL = 'http://localhost:3001';
  });
});