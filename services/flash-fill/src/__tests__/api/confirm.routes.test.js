process.env.JWT_SECRET          = process.env.JWT_SECRET          || 'test-secret-krono-2026';
process.env.JWT_EXPIRY_SECONDS  = process.env.JWT_EXPIRY_SECONDS  || '120';
process.env.FLASH_FILL_BASE_URL = process.env.FLASH_FILL_BASE_URL || 'http://localhost:3001';

const request = require('supertest');

jest.mock('../../services/jwtService', () => ({
  verifyConfirmationToken: jest.fn().mockReturnValue({
    auction_id:     'auction-001',
    patient_id:     'patient-001',
    appointment_id: 'appt-001'
  })
}));

jest.mock('../../services/lockService', () => ({
  tryAcquireAuctionLock: jest.fn().mockResolvedValue({
    lockAcquired:      true,
    existingLockValue: null,
    lockKey:           'auction:lock:auction-001'
  })
}));

jest.mock('../../services/auctionResolver', () => ({
  resolveAuctionWinner: jest.fn().mockResolvedValue({
    success:        true,
    statusCode:     200,
    responsePayload: {
      status: 'reassigned',
      winner: {
        patient_id:   'patient-001',
        display_name: 'Test Paciente'
      }
    }
  })
}));

jest.mock('../../config/database', () => ({
  query: jest.fn().mockResolvedValue({
    rowCount: 1,
    rows: [
      {
        id:        'auction-001',
        estado:    'activa',
        expira_en: new Date(Date.now() + 60_000).toISOString()
      }
    ]
  })
}));

const app = require('../../app');

describe('GET /api/v1/confirm/:token', () => {
  test('confirma cupo con token válido', async () => {
    const res = await request(app).get('/api/v1/confirm/FAKE_TOKEN');

    // Debe pasar por verifyConfirmationToken → lock → resolveAuctionWinner
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.status).toBe('reassigned');
    expect(res.body.winner.patient_id).toBe('patient-001');
  });

  test('token inválido (jwtService lanza JsonWebTokenError) → 401', async () => {
    const { verifyConfirmationToken } = require('../../services/jwtService');
    verifyConfirmationToken.mockImplementationOnce(() => {
      const err = new Error('bad token');
      err.name = 'JsonWebTokenError';
      throw err;
    });

    const res = await request(app).get('/api/v1/confirm/INVALID_TOKEN');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Token inválido');
  });

  test('token expirado (jwtService lanza TokenExpiredError) → 410', async () => {
    const { verifyConfirmationToken } = require('../../services/jwtService');
    verifyConfirmationToken.mockImplementationOnce(() => {
      const err = new Error('expired');
      err.name = 'TokenExpiredError';
      throw err;
    });

    const res = await request(app).get('/api/v1/confirm/EXPIRED_TOKEN');
    expect(res.statusCode).toBe(410);
    expect(res.body.error).toBe('El token ha expirado');
  });
});