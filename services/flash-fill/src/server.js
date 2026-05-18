require('dotenv').config();

const app = require('./app');
const { testDatabaseConnection } = require('./config/database');
const { testRedisConnection } = require('./config/redis');

const PORT = Number(process.env.PORT || 3002);

async function bootstrap() {
  try {
    await testDatabaseConnection();
    await testRedisConnection();

    app.listen(PORT, () => {
      console.log(`[flash-fill] servicio escuchando en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('[flash-fill] error al iniciar el servicio:', error);
    process.exit(1);
  }
}

bootstrap();