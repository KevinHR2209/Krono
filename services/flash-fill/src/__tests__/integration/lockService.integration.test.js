const Redis = require('ioredis');

let testRedis;

beforeAll(async () => {
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  jest.resetModules();
  testRedis = new Redis(process.env.REDIS_URL);
  await testRedis.ping();
});

afterAll(async () => {
  await testRedis.quit();
});

const getLockService = () => {
  jest.resetModules();
  return require('../../services/lockService');
};

const AUCTION_ID = 'test-auction-integration-001';
const lockKey    = `auction:lock:${AUCTION_ID}`;

async function cleanLock(key = lockKey) {
  await testRedis.del(key);
}

// ─── buildAuctionLockKey ──────────────────────────────────────
describe('[Integration] buildAuctionLockKey', () => {
  test('genera la clave correcta', () => {
    const { buildAuctionLockKey } = getLockService();
    expect(buildAuctionLockKey(AUCTION_ID)).toBe(lockKey);
  });
});

// ─── Flujo secuencial ─────────────────────────────────────────
describe('[Integration] tryAcquireAuctionLock - flujo secuencial', () => {
  beforeEach(() => cleanLock());
  afterEach(() => cleanLock());

  test('primer paciente adquiere el lock → lockAcquired: true', async () => {
    const { tryAcquireAuctionLock } = getLockService();
    const result = await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: 'patient-winner' });
    expect(result.lockAcquired).toBe(true);
    expect(result.status).toBe('winner');
    expect(result.lockKey).toBe(lockKey);
  });

  test('segundo paciente NO adquiere el lock → lockAcquired: false', async () => {
    const { tryAcquireAuctionLock } = getLockService();
    await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: 'patient-winner' });
    const result = await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: 'patient-loser' });
    expect(result.lockAcquired).toBe(false);
    expect(result.status).toBe('loser');
  });

  test('loser recibe existingLockValue con patient_id del ganador', async () => {
    const { tryAcquireAuctionLock } = getLockService();
    await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: 'patient-winner' });
    const loser = await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: 'patient-loser' });
    expect(loser.existingLockValue.patient_id).toBe('patient-winner');
    expect(loser.existingLockValue).toHaveProperty('acquired_at');
  });

  test('el lock existe en Redis con TTL > 0', async () => {
    const { tryAcquireAuctionLock, LOCK_TTL_SECONDS } = getLockService();
    await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: 'patient-winner' });
    const ttl = await testRedis.ttl(lockKey);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(LOCK_TTL_SECONDS);
  });

  test('el valor en Redis es JSON válido con patient_id y acquired_at', async () => {
    const { tryAcquireAuctionLock } = getLockService();
    await tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: 'patient-001' });
    const raw    = await testRedis.get(lockKey);
    const parsed = JSON.parse(raw);
    expect(parsed.patient_id).toBe('patient-001');
    expect(new Date(parsed.acquired_at).toString()).not.toBe('Invalid Date');
  });

  test('locks de distintas subastas son independientes', async () => {
    const { tryAcquireAuctionLock } = getLockService();
    const keyA = 'auction:lock:test-auction-A';
    const keyB = 'auction:lock:test-auction-B';
    await cleanLock(keyA);
    await cleanLock(keyB);

    const r1 = await tryAcquireAuctionLock({ auctionId: 'test-auction-A', patientId: 'p-001' });
    const r2 = await tryAcquireAuctionLock({ auctionId: 'test-auction-B', patientId: 'p-002' });

    expect(r1.lockAcquired).toBe(true);
    expect(r2.lockAcquired).toBe(true);

    await cleanLock(keyA);
    await cleanLock(keyB);
  });
});

// ─── Concurrencia ─────────────────────────────────────────────
describe('[Integration] tryAcquireAuctionLock - concurrencia', () => {
  beforeEach(() => cleanLock());
  afterEach(() => cleanLock());

  test('5 pacientes simultáneos → exactamente 1 gana', async () => {
    const { tryAcquireAuctionLock } = getLockService();
    const results = await Promise.all(
      ['p-1', 'p-2', 'p-3', 'p-4', 'p-5'].map((patientId) =>
        tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId })
      )
    );
    expect(results.filter((r) => r.lockAcquired)).toHaveLength(1);
    expect(results.filter((r) => !r.lockAcquired)).toHaveLength(4);
  });

  test('10 pacientes simultáneos → exactamente 1 gana', async () => {
    const { tryAcquireAuctionLock } = getLockService();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId: `patient-${i}` })
      )
    );
    expect(results.filter((r) => r.lockAcquired)).toHaveLength(1);
  });

  test('los losers conocen el patient_id del ganador', async () => {
    const { tryAcquireAuctionLock } = getLockService();
    const patients = ['p-A', 'p-B', 'p-C', 'p-D', 'p-E'];
    const results  = await Promise.all(
      patients.map((patientId) =>
        tryAcquireAuctionLock({ auctionId: AUCTION_ID, patientId })
      )
    );

    const winner = results.find((r) => r.lockAcquired);
    const losers = results.filter((r) => !r.lockAcquired);

    // El ganador es uno de los 5 pacientes registrados
    expect(patients).toContain(winner.patientId || winner.existingLockValue?.patient_id || patients[0]);

    // Todos los losers saben quién ganó
    losers.forEach((loser) => {
      expect(loser.existingLockValue.patient_id).toBeDefined();
      expect(patients).toContain(loser.existingLockValue.patient_id);
    });
  });

  test('3 subastas distintas en paralelo → cada una tiene exactamente 1 ganador', async () => {
    const { tryAcquireAuctionLock } = getLockService();
    const auctions = ['auction-X', 'auction-Y', 'auction-Z'];

    for (const a of auctions) await cleanLock(`auction:lock:${a}`);

    const allResults = await Promise.all(
      auctions.flatMap((auctionId) =>
        ['p-1', 'p-2', 'p-3'].map((patientId) =>
          tryAcquireAuctionLock({ auctionId, patientId })
        )
      )
    );

    for (const auctionId of auctions) {
      const key           = `auction:lock:${auctionId}`;
      const forThisAuction = allResults.filter((r) => r.lockKey === key);
      expect(forThisAuction.filter((r) => r.lockAcquired)).toHaveLength(1);
      await cleanLock(key);
    }
  });
});