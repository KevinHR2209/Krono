// __tests__/lockService.test.js
const { tryAcquireAuctionLock, buildAuctionLockKey } = require('../src/services/lockService');
const { redis } = require('../src/config/redis');

// Limpia la clave de Redis antes y después de cada test
beforeEach(async () => {
  await redis.del('auction:lock:test-123');
});

afterAll(async () => {
  await redis.quit();
});

describe('lockService — exclusión mutua con Redis', () => {

  test('el primer candidato adquiere el lock', async () => {
    const result = await tryAcquireAuctionLock({
      auctionId: 'test-123',
      patientId: 'paciente-A'
    });

    expect(result.lockAcquired).toBe(true);
    expect(result.status).toBe('winner');
  });

  test('el segundo candidato NO adquiere el lock si ya fue tomado', async () => {
    // Paciente A llega primero
    await tryAcquireAuctionLock({ auctionId: 'test-123', patientId: 'paciente-A' });

    // Paciente B llega después
    const result = await tryAcquireAuctionLock({
      auctionId: 'test-123',
      patientId: 'paciente-B'
    });

    expect(result.lockAcquired).toBe(false);
    expect(result.status).toBe('loser');
    // Y te dice quién ganó
    expect(result.existingLockValue.patient_id).toBe('paciente-A');
  });

  test('subastas distintas tienen locks independientes', async () => {
    const r1 = await tryAcquireAuctionLock({ auctionId: 'subasta-1', patientId: 'paciente-A' });
    const r2 = await tryAcquireAuctionLock({ auctionId: 'subasta-2', patientId: 'paciente-B' });

    // Ambos ganan porque son subastas diferentes
    expect(r1.lockAcquired).toBe(true);
    expect(r2.lockAcquired).toBe(true);

    await redis.del('auction:lock:subasta-1');
    await redis.del('auction:lock:subasta-2');
  });
  test('⚡ mide cuánto tarda Redis en dar el lock', async () => {
  await redis.del('auction:lock:speed-test');

  const inicio = performance.now();

  const result = await tryAcquireAuctionLock({
    auctionId: 'speed-test',
    patientId: 'paciente-A'
  });

  const fin = performance.now();
  const ms = (fin - inicio).toFixed(2);

  console.log(`Redis SETNX tardó: ${ms}ms`);

  expect(result.lockAcquired).toBe(true);
  expect(parseFloat(ms)).toBeLessThan(100); // debe ser menor a 100ms

  await redis.del('auction:lock:speed-test');
});
});