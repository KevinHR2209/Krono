const axios = require('axios');
const { query } = require('../config/database');

const RETURN_WEBHOOK_TIMEOUT_MS = Number(process.env.RETURN_WEBHOOK_TIMEOUT_MS || 5000);
const BACKOFF_SCHEDULE_MS = [1000, 3000, 9000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveToDeadLetterQueue({ referenceId, payload, errorDetail }) {
  await query(
    `
      INSERT INTO cola_letras_muertas (
        tipo_evento,
        id_referencia,
        payload,
        error_detalle,
        cantidad_intentos,
        ultimo_intento_en
      )
      VALUES ($1, $2, $3::jsonb, $4, $5, NOW())
    `,
    [
      'return_webhook_failed',
      String(referenceId),
      JSON.stringify(payload),
      errorDetail,
      3
    ]
  );
}

async function sendReturnEventWithRetry({ url, payload, referenceId }) {
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
        await sleep(BACKOFF_SCHEDULE_MS[attempt]);
      }
    }
  }

  await saveToDeadLetterQueue({
    referenceId,
    payload,
    errorDetail: lastError ? lastError.message : 'Error desconocido en return webhook'
  });

  return {
    success: false,
    attempts: 3,
    error: lastError ? lastError.message : 'Error desconocido en return webhook'
  };
}

module.exports = {
  sendReturnEventWithRetry
};