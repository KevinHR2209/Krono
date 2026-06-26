// __tests__/concurrency.test.js
const { tryAcquireAuctionLock } = require('../src/services/lockService');
const { redis } = require('../src/config/redis');

afterAll(async () => {
  await redis.quit();
});

test('🔥 5 candidatos simultáneos → exactamente 1 ganador', async () => {
  const auctionId = `concurrency-test-${Date.now()}`;

  // Lanzamos 5 peticiones al mismo tiempo con Promise.all
  const results = await Promise.all([
    tryAcquireAuctionLock({ auctionId, patientId: 'paciente-1' }),
    tryAcquireAuctionLock({ auctionId, patientId: 'paciente-2' }),
    tryAcquireAuctionLock({ auctionId, patientId: 'paciente-3' }),
    tryAcquireAuctionLock({ auctionId, patientId: 'paciente-4' }),
    tryAcquireAuctionLock({ auctionId, patientId: 'paciente-5' }),
  ]);
  

  const winners = results.filter(r => r.lockAcquired === true);
  const losers  = results.filter(r => r.lockAcquired === false);

  // La regla de oro: exactamente 1 ganador, 4 perdedores
  expect(winners).toHaveLength(1);
  expect(losers).toHaveLength(4);

  // Limpieza
  await redis.del(`auction:lock:${auctionId}`);
});