const IORedis = require('ioredis');

let redisClient = null;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 50, 2000);
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis connected successfully');
    });
  }

  return redisClient;
}

async function connectRedis() {
  const client = getRedisClient();
  await client.ping();
  return client;
}

async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

module.exports = {
  getRedisClient,
  connectRedis,
  disconnectRedis
};