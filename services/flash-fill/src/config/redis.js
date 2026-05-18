const Redis = require('ioredis');

if (!process.env.REDIS_URL) {
  throw new Error('Falta la variable de entorno REDIS_URL');
}

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

redis.on('connect', () => {
  console.log('[flash-fill][redis] conectado');
});

redis.on('error', (error) => {
  console.error('[flash-fill][redis] error:', error.message);
});

async function testRedisConnection() {
  await redis.ping();
  console.log('[flash-fill][redis] ping OK');
}

module.exports = {
  redis,
  testRedisConnection
};