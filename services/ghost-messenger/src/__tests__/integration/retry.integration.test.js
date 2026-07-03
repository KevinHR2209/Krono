const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');

describe('retry integration', () => {
  test('reintenta y luego completa', async () => {
    const connection = new Redis(process.env.REDIS_URL);
    const queue = new Queue('retry-queue', { connection });
    let attempts = 0;

    const worker = new Worker('retry-queue', async () => {
      attempts += 1;
      if (attempts < 2) throw new Error('fail once');
      return { ok: true };
    }, { connection });

    const job = await queue.add('retry-job', {}, { attempts: 2, backoff: { type: 'fixed', delay: 100 } });
    const result = await job.waitUntilFinished(worker);

    expect(result.ok).toBe(true);
    expect(attempts).toBe(2);

    await worker.close();
    await queue.close();
    await connection.quit();
  });
});