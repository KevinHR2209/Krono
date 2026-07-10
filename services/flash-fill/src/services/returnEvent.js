const axios = require('axios');
const { query } = require('../config/database');

const RETURN_WEBHOOK_TIMEOUT_MS = Number(process.env.RETURN_WEBHOOK_TIMEOUT_MS || 5000);
const BACKOFF_SCHEDULE_MS = [1000, 3000, 9000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveToDeadLetterQueue({ transactionId, correlationId, url, payload, errorDetail }) {
  await query(
      `
        INSERT INTO cola_letras_muertas (
          id_transaccion,
          id_correlacion,
          tipo_evento,
          url_destino,
          payload,
          mensaje_error,
          intentos,
          ultimo_intento_en
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW())
      `,
      [
        transactionId,
        correlationId,
        'return_webhook_failed',
        url,
        JSON.stringify(payload),
        errorDetail,
        BACKOFF_SCHEDULE_MS.length
      ]
  );
}

async function sendReturnEventWithRetry({ url, payload, transactionId, correlationId }) {
  if (!url) {
    throw new Error('La subasta no tiene url_retorno configurada');
  }

  let lastError = null;

  for (let attempt = 0; attempt < BACKOFF_SCHEDULE_MS.length; attempt += 1) {
    try {
      await axios.post(url, payload, {
        timeout: RETURN_WEBHOOK_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        attempts: attempt + 1
      };
    } catch (error) {
      lastError = error;
      const shouldWait = attempt < BACKOFF_SCHEDULE_MS.length - 1;

      if (shouldWait) {
        console.warn(`[Flash-Fill] Intento ${attempt + 1} fallido hacia ${url}. Reintentando en ${BACKOFF_SCHEDULE_MS[attempt]}ms...`);
        await sleep(BACKOFF_SCHEDULE_MS[attempt]);
      }
    }
  }

  // Si llegamos aquí, se agotaron los reintentos. Se va a la DLQ.
  console.error(`[Flash-Fill] Webhook falló tras ${BACKOFF_SCHEDULE_MS.length} intentos. Enviando a DLQ...`);

  await saveToDeadLetterQueue({
    transactionId,
    correlationId,
    url,
    payload,
    errorDetail: lastError ? lastError.message : 'Error desconocido en return webhook'
  });

  return {
    success: false,
    attempts: BACKOFF_SCHEDULE_MS.length,
    error: lastError ? lastError.message : 'Error desconocido en return webhook'
  };
}

module.exports = {
  sendReturnEventWithRetry
};