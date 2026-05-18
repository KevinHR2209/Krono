const express = require('express');
const { verifyConfirmationToken } = require('../services/jwtService');
const { tryAcquireAuctionLock } = require('../services/lockService');
const { resolveAuctionWinner } = require('../services/auctionResolver');
const { query } = require('../config/database');

const router = express.Router();

router.get('/confirm/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const decoded = verifyConfirmationToken(token);

    const auctionId = Number(decoded.auction_id);
    const patientId = decoded.patient_id;
    const appointmentId = decoded.appointment_id;

    if (!auctionId || !patientId || !appointmentId) {
      return res.status(400).json({
        error: 'Token inválido: faltan datos requeridos'
      });
    }

    const auctionStatusResult = await query(
      `
        SELECT id, estado, expira_en
        FROM subastas
        WHERE id = $1
      `,
      [auctionId]
    );

    if (auctionStatusResult.rowCount === 0) {
      return res.status(404).json({
        error: 'Subasta no encontrada'
      });
    }

    const auction = auctionStatusResult.rows[0];

    if (auction.estado !== 'activa') {
      return res.status(409).json({
        error: `La subasta ya no está disponible. Estado actual: ${auction.estado}`
      });
    }

    if (new Date(auction.expira_en).getTime() < Date.now()) {
      await query(
        `
          UPDATE subastas
          SET estado = 'expirada', updated_at = NOW()
          WHERE id = $1
        `,
        [auctionId]
      );

      await query(
        `
          UPDATE transacciones
          SET estado = 'expirado', updated_at = NOW()
          WHERE id_subasta = $1
        `,
        [auctionId]
      );

      return res.status(410).json({
        error: 'El enlace de confirmación ha expirado'
      });
    }

    const lockResult = await tryAcquireAuctionLock({
      auctionId,
      patientId
    });

    if (!lockResult.lockAcquired) {
      return res.status(409).json({
        error: 'El cupo ya fue tomado por otro candidato',
        winner: lockResult.existingLockValue || null
      });
    }

    const resolution = await resolveAuctionWinner({
      auctionId,
      patientId,
      appointmentId
    });

    return res.status(resolution.statusCode).json(resolution.responsePayload);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(410).json({
        error: 'El token ha expirado'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token inválido'
      });
    }

    if (
      error.message.includes('ya no está activa') ||
      error.message.includes('no participa')
    ) {
      return res.status(409).json({
        error: error.message
      });
    }

    console.error('[flash-fill][confirm] error:', error);

    return res.status(500).json({
      error: 'No fue posible procesar la confirmación'
    });
  }
});

module.exports = router;