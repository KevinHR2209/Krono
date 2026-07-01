// Mock de Redis para que no necesite conexión real

jest.mock('../../config/redis', () => ({
  redis: {
    set: jest.fn(),
    get: jest.fn()
  }
}));

const { redis } = require('../../config/redis');
const {
  tryAcquireAuctionLock,
  buildAuctionLockKey,
  LOCK_TTL_SECONDS
} = require('../../services/lockService');

const AUCTION_ID = 'auction-uuid-001';
const PATIENT_ID = 'patient-uuid-001';

// ─── buildAuctionLockKey ──────────────────────────────────────
describe('buildAuctionLockKey', () => {
  test('retorna key con formato "auction:lock:<auctionId>"', () => {
    expect(buildAuctionLockKey(AUCTION_ID)).toBe(`auction:lock:${AUCTION_ID}`);
  });

  test('clave es única por auctionId', () => {
    const k1 = buildAuctionLockKey('auction-001');
    const k2 = buildAuctionLockKey('auction-002');
    expect(k1).not.toBe(k2);
  });
});

// ─── LOCK_TTL_SECONDS ─────────────────────────────────────────
describe('LOCK_TTL_SECONDS', () => {
  test('es 120 segundos (mismo que JWT_EXPIRY)', () => {
    expect(LOCK_TTL_SECONDS).toBe(120);
  });
});

// ─── tryAcquireAuctionLock ────────────────────────────────────
describe('tryAcquireAuctionLock', () => {
  beforeEach(() => jest.clearAllMocks());

  test('primer intento → lockAcquired = true, status = "winner"', async () => {
    redis.set.mockResolvedValue('OK');

    const result = await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: PATIENT_ID });
    expect(result.lockAcquired).toBe(true);
    expect(result.status).toBe('winner');
    expect(result.lockKey).toBe(`auction:lock:${AUCTION_ID}`);
  });

  test('segundo intento (lock ya tomado) → lockAcquired = false, status = "loser"', async () => {
    redis.set.mockResolvedValue(null); // NX no aplicó
    redis.get.mockResolvedValue(JSON.stringify({
      patient_id: 'otro-paciente',
      acquired_at: new Date().toISOString()
    }));

    const result = await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: PATIENT_ID });
    expect(result.lockAcquired).toBe(false);
    expect(result.status).toBe('loser');
  });

  test('loser recibe existingLockValue con patient_id del ganador', async () => {
    const winner = { patient_id: 'ganador-001', acquired_at: '2026-07-01T10:00:00.000Z' };
    redis.set.mockResolvedValue(null);
    redis.get.mockResolvedValue(JSON.stringify(winner));

    const result = await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: PATIENT_ID });
    expect(result.existingLockValue.patient_id).toBe('ganador-001');
  });

  test('llama a redis.set con NX y EX para garantizar atomicidad', async () => {
    redis.set.mockResolvedValue('OK');

    await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: PATIENT_ID });
    expect(redis.set).toHaveBeenCalledWith(
      `auction:lock:${AUCTION_ID}`,
      expect.any(String),
      'NX',
      'EX',
      LOCK_TTL_SECONDS
    );
  });

  test('el valor almacenado en Redis incluye patient_id y acquired_at', async () => {
    redis.set.mockResolvedValue('OK');

    await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: PATIENT_ID });
    const setCall = redis.set.mock.calls[0];
    const storedValue = JSON.parse(setCall[1]);
    expect(storedValue.patient_id).toBe(PATIENT_ID);
    expect(storedValue).toHaveProperty('acquired_at');
  });

  test('si existingLockValue en Redis es null → existingLockValue retornado es null', async () => {
    redis.set.mockResolvedValue(null);
    redis.get.mockResolvedValue(null);

    const result = await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: PATIENT_ID });
    expect(result.existingLockValue).toBeNull();
  });

  test('dos pacientes distintos compitiendo → solo uno gana', async () => {
    // Primero: winner
    redis.set.mockResolvedValueOnce('OK');
    const r1 = await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: 'p-winner' });

    // Segundo: loser
    redis.set.mockResolvedValueOnce(null);
    redis.get.mockResolvedValueOnce(JSON.stringify({ patient_id: 'p-winner', acquired_at: new Date().toISOString() }));
    const r2 = await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: 'p-loser' });

    expect(r1.lockAcquired).toBe(true);
    expect(r2.lockAcquired).toBe(false);
  });
});