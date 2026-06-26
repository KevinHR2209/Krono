// __tests__/confirm.test.js
const request = require('supertest');
const app = require('../src/app');

// --- Mocks: reemplazamos Redis y PG con versiones falsas ---

jest.mock('../src/services/jwtService', () => ({
  verifyConfirmationToken: jest.fn()
}));

jest.mock('../src/services/lockService', () => ({
  tryAcquireAuctionLock: jest.fn()
}));

jest.mock('../src/services/auctionResolver', () => ({
  resolveAuctionWinner: jest.fn()
}));

jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

const { verifyConfirmationToken } = require('../src/services/jwtService');
const { tryAcquireAuctionLock } = require('../src/services/lockService');
const { resolveAuctionWinner } = require('../src/services/auctionResolver');
const { query } = require('../src/config/database');

describe('GET /api/v1/confirm/:token', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Token válido y cupo disponible → 200 reasignado', async () => {
    // Simulamos un token válido
    verifyConfirmationToken.mockReturnValue({
      auction_id: 'subasta-1',
      patient_id: 'paciente-A',
      appointment_id: 'cita-99'
    });

    // Simulamos que la subasta está activa y no expirada
    query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 'subasta-1', estado: 'activa', expira_en: new Date(Date.now() + 60000) }]
    });

    // Simulamos que Redis da el lock al primero
    tryAcquireAuctionLock.mockResolvedValue({ lockAcquired: true });

    // Simulamos que la BD guarda todo bien
    resolveAuctionWinner.mockResolvedValue({
      statusCode: 200,
      responsePayload: { status: 'reassigned', winner: { patient_id: 'paciente-A' } }
    });

    const res = await request(app).get('/api/v1/confirm/token-valido');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('reassigned');
  });

  test('Segundo candidato → 409 cupo ya tomado', async () => {
    verifyConfirmationToken.mockReturnValue({
      auction_id: 'subasta-1',
      patient_id: 'paciente-B',
      appointment_id: 'cita-99'
    });

    query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 'subasta-1', estado: 'activa', expira_en: new Date(Date.now() + 60000) }]
    });

    // Redis dice: ya hay un ganador
    tryAcquireAuctionLock.mockResolvedValue({
      lockAcquired: false,
      existingLockValue: { patient_id: 'paciente-A' }
    });

    const res = await request(app).get('/api/v1/confirm/token-paciente-b');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/cupo ya fue tomado/);
  });

  test('Enlace expirado → 410', async () => {
    verifyConfirmationToken.mockReturnValue({
      auction_id: 'subasta-1',
      patient_id: 'paciente-A',
      appointment_id: 'cita-99'
    });

    // La fecha de expiración ya pasó
    query.mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 'subasta-1', estado: 'activa', expira_en: new Date(Date.now() - 5000) }]
    });

    const res = await request(app).get('/api/v1/confirm/token-expirado');

    expect(res.status).toBe(410);
  });

  test('Token inválido → 401', async () => {
    verifyConfirmationToken.mockImplementation(() => {
      const err = new Error('jwt malformed');
      err.name = 'JsonWebTokenError';
      throw err;
    });

    const res = await request(app).get('/api/v1/confirm/token-basura');

    expect(res.status).toBe(401);
  });
});