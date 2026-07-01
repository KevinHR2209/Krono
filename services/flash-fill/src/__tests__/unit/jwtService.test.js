// Seteamos el secret ANTES del require para evitar el throw del módulo
process.env.JWT_SECRET = 'test-secret-flash-fill-2026';
process.env.JWT_EXPIRY_SECONDS = '120';

const jwt = require('jsonwebtoken');
const { generateConfirmationToken, verifyConfirmationToken } = require('../../services/jwtService');

const VALID_PAYLOAD = {
  auction_id:     'auction-uuid-001',
  patient_id:     'patient-uuid-001',
  appointment_id: 'appointment-uuid-001'
};

// ─── generateConfirmationToken ────────────────────────────────
describe('generateConfirmationToken', () => {
  test('retorna un string con formato JWT (3 partes separadas por .)', () => {
    const token = generateConfirmationToken(VALID_PAYLOAD);
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });

  test('el payload decodificado contiene auction_id', () => {
    const token = generateConfirmationToken(VALID_PAYLOAD);
    const decoded = jwt.decode(token);
    expect(decoded.auction_id).toBe(VALID_PAYLOAD.auction_id);
  });

  test('el payload decodificado contiene patient_id', () => {
    const token = generateConfirmationToken(VALID_PAYLOAD);
    const decoded = jwt.decode(token);
    expect(decoded.patient_id).toBe(VALID_PAYLOAD.patient_id);
  });

  test('el payload decodificado contiene appointment_id', () => {
    const token = generateConfirmationToken(VALID_PAYLOAD);
    const decoded = jwt.decode(token);
    expect(decoded.appointment_id).toBe(VALID_PAYLOAD.appointment_id);
  });

  test('usa algoritmo HS256', () => {
    const token = generateConfirmationToken(VALID_PAYLOAD);
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
    expect(header.alg).toBe('HS256');
  });

  test('el token expira en ~120 segundos', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = generateConfirmationToken(VALID_PAYLOAD);
    const decoded = jwt.decode(token);
    const diff = decoded.exp - before;
    expect(diff).toBeGreaterThanOrEqual(118);
    expect(diff).toBeLessThanOrEqual(122);
  });

  test('el token NO es verificable con un secret distinto', () => {
    const token = generateConfirmationToken(VALID_PAYLOAD);
    expect(() => {
      jwt.verify(token, 'wrong-secret', { algorithms: ['HS256'] });
    }).toThrow();
  });
});

// ─── verifyConfirmationToken ──────────────────────────────────
describe('verifyConfirmationToken', () => {
  test('token válido → retorna payload con auction_id', () => {
    const token = generateConfirmationToken(VALID_PAYLOAD);
    const decoded = verifyConfirmationToken(token);
    expect(decoded.auction_id).toBe(VALID_PAYLOAD.auction_id);
  });

  test('token válido → retorna payload con patient_id y appointment_id', () => {
    const token = generateConfirmationToken(VALID_PAYLOAD);
    const decoded = verifyConfirmationToken(token);
    expect(decoded.patient_id).toBe(VALID_PAYLOAD.patient_id);
    expect(decoded.appointment_id).toBe(VALID_PAYLOAD.appointment_id);
  });

  test('token con firma incorrecta → lanza JsonWebTokenError', () => {
    const token = generateConfirmationToken(VALID_PAYLOAD);
    const [header, payload] = token.split('.');
    const tampered = `${header}.${payload}.invalidsignature`;
    expect(() => verifyConfirmationToken(tampered)).toThrow();
  });

  test('token expirado → lanza TokenExpiredError', () => {
    const expired = jwt.sign(VALID_PAYLOAD, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: -1
    });
    expect(() => verifyConfirmationToken(expired)).toThrow(/expired/i);
  });

  test('token generado con secret distinto → lanza error', () => {
    const tokenOtro = jwt.sign(VALID_PAYLOAD, 'otro-secret', { algorithm: 'HS256' });
    expect(() => verifyConfirmationToken(tokenOtro)).toThrow();
  });

  test('string vacío → lanza error', () => {
    expect(() => verifyConfirmationToken('')).toThrow();
  });

  test('token malformado → lanza error', () => {
    expect(() => verifyConfirmationToken('no.es.jwt.valido.esto')).toThrow();
  });
});

// ─── Interoperabilidad ghost-messenger ↔ flash-fill ──────────
describe('Contrato JWT: ghost-messenger genera, flash-fill verifica', () => {
  test('token generado por ghost-messenger es válido en flash-fill con mismo secret', () => {
    // Simula ghost-messenger generando el token
    const tokenDeGhost = jwt.sign(
      { auction_id: 'a-001', patient_id: 'p-001', appointment_id: 'ap-001' },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: 120 }
    );
    // flash-fill lo verifica
    const decoded = verifyConfirmationToken(tokenDeGhost);
    expect(decoded.auction_id).toBe('a-001');
    expect(decoded.patient_id).toBe('p-001');
  });
});