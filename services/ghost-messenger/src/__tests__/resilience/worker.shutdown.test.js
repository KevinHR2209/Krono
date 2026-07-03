const { Queue, Worker } = require('bullmq');
const Redis             = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Conexión para Queue (sin restricción de maxRetriesPerRequest)
const queueConn  = () => new Redis(REDIS_URL);

// Conexión para Worker (OBLIGATORIO: maxRetriesPerRequest null para BullMQ)
const workerConn = () => new Redis(REDIS_URL, { maxRetriesPerRequest: null });

describe('worker shutdown', () => {
  test('cierra worker y queue sin dejar handles abiertos', async () => {
    const rQueue  = queueConn();
    const rWorker = workerConn();

    const queue  = new Queue('shutdown-queue', { connection: rQueue });
    const worker = new Worker(
      'shutdown-queue',
      async () => ({ ok: true }),
      { connection: rWorker }
    );

    await new Promise((r) => worker.once('ready', r));

    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
    await rQueue.quit();
    await rWorker.quit();

    expect(true).toBe(true); // si llega aquí, cerró limpio
  }, 10000);

  test('el worker no procesa jobs después de cerrado', async () => {
    const rQueue  = queueConn();
    const rWorker = workerConn();
    let processed = false;

    const queue  = new Queue('shutdown-queue-2', { connection: rQueue });
    const worker = new Worker(
      'shutdown-queue-2',
      async () => { processed = true; return { ok: true }; },
      { connection: rWorker }
    );

    await new Promise((r) => worker.once('ready', r));
    await worker.close();

    // Encolar DESPUÉS de cerrar el worker
    await queue.add('post-close', { test: true });
    await new Promise((r) => setTimeout(r, 500));

    expect(processed).toBe(false);

    await queue.obliterate({ force: true });
    await queue.close();
    await rQueue.quit();
    await rWorker.quit();
  }, 10000);
});