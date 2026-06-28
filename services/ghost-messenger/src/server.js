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
      console.log(`Ghost-Messenger funcionando en el puerto ${PORT}`);
      console.log(`Queue: ${process.env.BULLMQ_QUEUE_NAME}`);
    });
  } catch (error) {
    console.error('Fallo en iniciar GhostMessenger:', error);
    process.exit(1);
  }
}

startServer();