const { Queue, Worker } = require('bullmq');
const workerConfig = require('../config/workerConfig');
const { generateJwt } = require('../services/jwtService');
const { sendWhatsAppMessage } = require('../services/whatsappService');

let queue = null;
let worker = null;

function buildConfirmLink(patientId, auctionId, appointmentId) {
  const token = generateJwt(auctionId, patientId, appointmentId);
  const baseUrl = process.env.FLASH_FILL_BASE_URL || 'http://localhost:3001';
  return `${baseUrl}/api/v1/confirm/${token}`;
}

function buildMessage(candidate, slot, confirmLink) {
  return `
🏥 *CUPO DISPONIBLE - KRONO*

Hola *${candidate.display_name}*, tienes un cupo disponible.

📅 *Fecha:* ${slot.date}
⏰ *Hora:* ${slot.start_time} - ${slot.end_time}
👨‍⚕️ *Doctor:* ${slot.doctor_name}
🩺 *Especialidad:* ${slot.specialty}
📍 *Lugar:* ${slot.location}

Haz clic aquí para confirmar:
${confirmLink}

⚠️ Este enlace expira en 2 minutos.
`.trim();
}

function normalizeCandidates(jobData) {
  const candidates = Array.isArray(jobData?.candidates)
    ? jobData.candidates
    : Array.isArray(jobData?.top_candidates)
      ? jobData.top_candidates
      : Array.isArray(jobData?.ranked_candidates)
        ? jobData.ranked_candidates.slice(0, 5)
        : [];

  return candidates;
}

async function processNotificationJob(job) {
  const data = job?.data || {};
  const auctionId = data.auction_id;
  const appointmentId = data.appointment_id;
  const slot = data.slot;
  const candidates = normalizeCandidates(data);

  if (!auctionId || !appointmentId || !slot || !Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('Invalid job data: auction_id, appointment_id, slot and at least one candidate are required');
  }

  const top5Candidates = candidates.slice(0, 5);
  const results = [];

  for (const candidate of top5Candidates) {
    if (!candidate?.patient_id || !candidate?.phone || !candidate?.display_name) {
      throw new Error('Invalid candidate data');
    }

    const confirmLink = buildConfirmLink(candidate.patient_id, auctionId, appointmentId);
    const message = buildMessage(candidate, slot, confirmLink);
    const sendResult = await sendWhatsAppMessage(candidate.phone, message);

    results.push({
      patient_id: candidate.patient_id,
      display_name: candidate.display_name,
      phone: candidate.phone,
      sent: sendResult.success,
      messageId: sendResult.messageId || null,
      link: confirmLink
    });

    if (!sendResult.success) {
      throw new Error(`WhatsApp send failed for ${candidate.patient_id}: ${sendResult.error}`);
    }
  }

  return {
    auction_id: auctionId,
    total_notified: results.filter((r) => r.sent).length,
    results
  };
}

async function startWorker() {
  if (queue || worker) return;

  queue = new Queue(workerConfig.queueName, {
    connection: workerConfig.redisUrl
  });

  worker = new Worker(
    workerConfig.queueName,
    async (job) => processNotificationJob(job),
    {
      connection: workerConfig.redisUrl,
      concurrency: workerConfig.workerOptions.concurrency
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`❌ Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('🔥 Worker error:', error);
  });

  console.log(`👷 Worker started for queue: ${workerConfig.queueName}`);
  console.log(`🔄 Concurrency: ${workerConfig.workerOptions.concurrency}`);
  console.log(`🔁 Max attempts: ${workerConfig.jobOptions.attempts}`);
}

async function enqueueNotification(auctionId, appointmentId, slot, candidates) {
  if (!queue) {
    throw new Error('Worker not started. Call startWorker() first.');
  }

  return queue.add(
    'notify-candidates',
    {
      auction_id: auctionId,
      appointment_id: appointmentId,
      slot,
      candidates
    },
    workerConfig.jobOptions
  );
}

async function closeWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }

  if (queue) {
    await queue.close();
    queue = null;
  }
}

module.exports = {
  startWorker,
  enqueueNotification,
  closeWorker
};