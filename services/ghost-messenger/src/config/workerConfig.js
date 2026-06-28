module.exports = {
  queueName: process.env.BULLMQ_QUEUE_NAME || 'ghost-messenger-notifications',
  workerOptions: {
    concurrency: 5,
    drainDelay: 10
  },
  jobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: {
      count: 100,
      age: 3600
    },
    removeOnFail: {
      count: 1000
    }
  },
  redisConnection: (() => {
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return { host: url.hostname, port: Number(url.port) || 6379 };
})()
};