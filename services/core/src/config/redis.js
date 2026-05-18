const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('Falta la variable de entorno REDIS_URL');
}

const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true
});

redisConnection.on('connect', () => {
  console.log('[core][redis] Conectado a Redis');
});

redisConnection.on('error', (error) => {
  console.error('[core][redis] Error:', error.message);
});

module.exports = {
  redisConnection
};