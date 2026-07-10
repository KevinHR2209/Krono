const app = require('./app');
const { startExpirationWorker } = require('./workers/expirationWorker');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`[core] Servicio escuchando en http://localhost:${PORT}`);

  // Encendemos el Worker de Expiración en segundo plano
  startExpirationWorker();
});

// Manejo elegante de apagado (Graceful Shutdown)
process.on('SIGTERM', () => {
  console.log('[core] SIGTERM recibido, apagando servidor...');
  server.close(() => {
    console.log('[core] Servidor HTTP cerrado.');
    process.exit(0);
  });
});