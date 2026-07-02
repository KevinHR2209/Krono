process.env.JWT_SECRET          = 'test-secret-krono-2026';
process.env.JWT_EXPIRY_SECONDS  = '120';
process.env.FLASH_FILL_BASE_URL = 'http://localhost:3001';
process.env.REDIS_URL           = process.env.REDIS_URL || 'redis://localhost:6379';

const { Queue, Worker }          = require('bullmq');
const Redis                      = require('ioredis');
const workerConfig               = require('../../config/workerConfig');
const { processNotificationJob } = require('../../workers/notificationWorker');

// Cargamos los módulos reales y espiamos sus métodos directamente.
// El lazy require() del worker retorna el MISMO objeto del cache de Node,
// por lo que los spies sobre este objeto son interceptados correctamente.
const whatsappService = require('../../services/whatsappService');
const emailService    = require('../../services/emailService');

let sendWhatsAppMessage;
let sendEmailMessage;

beforeAll(() => {
  sendWhatsAppMessage = jest
    .spyOn(whatsappService, 'sendWhatsAppMessage')
    .mockResolvedValue({ success: true, messageId: 'wa-test-123' });
  sendEmailMessage = jest
    .spyOn(emailService, 'sendEmailMessage')
    .mockResolvedValue({ success: true, messageId: 'em-test-456' });
});

afterAll(() => {
  jest.restoreAllMocks();
});

// --- Infraestructura ---

const QUEUE_NAME = workerConfig.queueName;
const CONN       = () => new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

// Cada test usa un nombre de cola único → aislamiento total sin necesidad de obliterate.
// Ningún job de un test anterior puede ser visto por el polling de otro test.
let testQueueName;

const RUN_ID = Date.now();
let testCounter = 0;

const BASE_CANDIDATE = {
  patient_id: 'patient-int-001', display_name: 'Carlos Prueba',
  phone: '+56991234567', email: 'carlos@test.com',
  attendance_history: 0.8, latitud: null, longitud: null,
  distancia_km: 15, historial_asistencia_normalizado: 0.8,
  distancia_normalizada: 0, puntaje_prioridad: 0.48, posicion_ranking: 1
};
const BASE_SLOT = {
  date: '2026-07-01', start_time: '10:00', end_time: '10:30',
  doctor_name: 'Matías Rojas', specialty: 'Corte Clásico', location: 'Local Principal'
};

function waitForJobCompletion(queue, jobId, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(async () => {
      try {
        const job   = await queue.getJob(jobId);
        if (!job) { clearInterval(iv); return reject(new Error('Job no encontrado')); }
        const state = await job.getState();
        if (state === 'completed') { clearInterval(iv); return resolve(job); }
        if (state === 'failed')    { clearInterval(iv); return reject(new Error(`Job fallido: ${job.failedReason}`)); }
        if (Date.now() - start > timeout) {
          clearInterval(iv);
          return reject(new Error(`Timeout esperando job ${jobId} (estado: ${state})`));
        }
      } catch (e) { clearInterval(iv); reject(e); }
    }, 150);
  });
}

// Crea Queue + Worker aislados sobre el nombre de cola del test actual.
async function createIsolatedQueue() {
  const redis  = CONN();
  const queue  = new Queue(testQueueName, { connection: redis });
  const worker = new Worker(
    testQueueName,
    (job) => processNotificationJob(job),
    { connection: CONN(), concurrency: 1 }
  );
  await new Promise((r) => worker.once('ready', r));
  return {
    queue,
    async close() {
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
      await redis.quit();
    }
  };
}

async function runTest(candidates, slot = BASE_SLOT) {
  const { queue, close } = await createIsolatedQueue();
  try {
    const job = await queue.add(
      'notify-candidates',
      {
        auction_id:     `auction-${RUN_ID}-${testCounter}`,
        appointment_id: `appt-${RUN_ID}-${testCounter}`,
        slot,
        candidates
      },
      workerConfig.jobOptions
    );
    await waitForJobCompletion(queue, job.id);
    return job;
  } finally {
    await close();
  }
}

// Asignar un nombre de cola único antes de cada test y limpiar spy counts
beforeEach(() => {
  testQueueName = `${workerConfig.queueName}-test-${RUN_ID}-${++testCounter}`;
  sendWhatsAppMessage.mockClear();
  sendEmailMessage.mockClear();
});

// --- Tests ---

describe('[Integration] notificationWorker - BullMQ + Redis real', () => {

  test('encola y procesa un job correctamente', async () => {
    const job = await runTest([BASE_CANDIDATE]);
    expect(job.id).toBeDefined();
  }, 12000);

  test('llama a sendWhatsAppMessage con el teléfono del candidato', async () => {
    await runTest([BASE_CANDIDATE]);
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(
      BASE_CANDIDATE.phone,
      expect.stringContaining('Carlos Prueba')
    );
  }, 12000);

  test('llama a sendEmailMessage cuando el candidato tiene email', async () => {
    await runTest([BASE_CANDIDATE]);
    expect(sendEmailMessage).toHaveBeenCalledWith(
      BASE_CANDIDATE.email,
      expect.objectContaining({ patient_id: BASE_CANDIDATE.patient_id }),
      expect.any(Object),
      expect.stringContaining('http://localhost:3001')
    );
  }, 12000);

  test('NO llama a sendEmailMessage si el candidato no tiene email', async () => {
    await runTest([{ ...BASE_CANDIDATE, email: null, patient_id: 'p-sin-email' }]);
    expect(sendEmailMessage).not.toHaveBeenCalled();
  }, 12000);

  test('procesa hasta 5 candidatos en un mismo job', async () => {
    const candidates = Array.from({ length: 5 }, (_, i) => ({
      ...BASE_CANDIDATE,
      patient_id: `patient-bulk-${i}`, display_name: `Paciente ${i}`,
      phone: `+5699900000${i}`, email: `p${i}@test.com`
    }));
    await runTest(candidates);
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(5);
    expect(sendEmailMessage).toHaveBeenCalledTimes(5);
  }, 20000);

  test('job con datos inválidos (sin slot) queda en estado "failed"', async () => {
    const { queue, close } = await createIsolatedQueue();
    try {
      const badJob = await queue.add(
        'notify-candidates',
        {
          auction_id:     `auction-bad-${RUN_ID}`,
          appointment_id: `appt-bad-${RUN_ID}`,
          slot:           null,
          candidates:     [BASE_CANDIDATE]
        },
        { attempts: 1 }
      );
      await expect(waitForJobCompletion(queue, badJob.id, 8000)).rejects.toThrow();
    } finally {
      await close();
    }
  }, 12000);
});