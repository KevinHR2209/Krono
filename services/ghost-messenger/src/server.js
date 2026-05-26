require('dotenv').config();

const app = require('./app');
const redisConfig = require('./config/redis');
const { startWorker } = require('./workers/notificationWorker');

const PORT = process.env.PORT || 3002;

async function startServer() {
  try {
    await redisConfig.connectRedis();
    await startWorker();

    app.listen(PORT, () => {
      console.log(`👻 Ghost-Messenger running on port ${PORT}`);
      console.log(`📦 Queue: ${process.env.BULLMQ_QUEUE_NAME}`);
    });
  } catch (error) {
    console.error('❌ Failed to start Ghost-Messenger:', error);
    process.exit(1);
  }
}

startServer();