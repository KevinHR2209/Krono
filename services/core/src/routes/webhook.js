const express = require('express');
const { validateWebhook } = require('../middleware/validateWebhook');
const { createAuction } = require('../services/auctionService');
const { generateCorrelationId } = require('../utils/correlationId');

const router = express.Router();

router.post('/api/v1/webhook/cancellation', validateWebhook, async (req, res) => {
  try {
    const receivedApiKey = req.header('x-api-key');
    const expectedApiKey = process.env.API_KEY;

    if (!expectedApiKey) {
      return res.status(500).json({
        error: 'API_KEY no configurada en el servicio'
      });
    }

    if (!receivedApiKey || receivedApiKey !== expectedApiKey) {
      return res.status(401).json({
        error: 'API Key inválida o ausente'
      });
    }

    const correlationId = generateCorrelationId();

    const result = await createAuction({
      payload: req.validatedWebhook,
      correlationId
    });

    return res.status(202).json({
      transaction_id: result.transaction_id,
      correlation_id: result.correlation_id,
      appointment_id: result.appointment_id,
      status: 'pending',
      message: 'Webhook procesado y subasta creada correctamente',
      top_5_selected: result.top_candidates.map((candidate) => ({
        patient_id: candidate.patient_id,
        display_name: candidate.display_name,
        priority_score: candidate.priority_score,
        rank_position: candidate.rank_position
      }))
    });
  } catch (error) {
    console.error('[core][webhook] Error procesando cancelación:', error);

    return res.status(500).json({
      error: 'Error interno al procesar la cancelación'
    });
  }
});

module.exports = router;