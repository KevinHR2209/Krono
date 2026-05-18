const { Queue } = require('bullmq');
const { redisConnection } = require('./redis');

const queueName = process.env.BULLMQ_QUEUE_NAME || 'ghost-messenger-notifications';

const notificationQueue = new Queue(queueName, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

module.exports = {
  queueName,
  notificationQueue
};