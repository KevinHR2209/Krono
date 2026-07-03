// src/__tests__/resilience/lockService.redisFailures.test.js
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    // métodos que usa tu lockService/config/redis
    set:  jest.fn().mockRejectedValue(new Error('Redis down')),
    get:  jest.fn().mockRejectedValue(new Error('Redis down')),
    ttl:  jest.fn().mockRejectedValue(new Error('Redis down')),
    del:  jest.fn().mockRejectedValue(new Error('Redis down')),
    ping: jest.fn().mockResolvedValue('PONG'),

    // IMPORTANTE: ioredis también tiene .on()
    on:   jest.fn(),  // para que src/config/redis.js pueda hacer redis.on('connect', ...)
  }));
});

describe('lockService - fallas de Redis', () => {
  test('tryAcquireAuctionLock lanza error cuando Redis está caído', async () => {
    jest.resetModules();
    const { tryAcquireAuctionLock } = require('../../services/lockService');

    await expect(
      tryAcquireAuctionLock({
        auctionId: 'auction-001',
        patientId: 'patient-001'
      })
    ).rejects.toThrow('Redis down');
  });
});