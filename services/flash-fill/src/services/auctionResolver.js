const { getClient } = require('../config/database');
const { sendReturnEventWithRetry } = require('./returnEvent');

async function resolveAuctionWinner({ auctionId, patientId, appointmentId }) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const auctionResult = await client.query(
      `
        SELECT
          s.id,
          s.id_cita,
          s.id_sistema_origen,
          s.id_correlacion,
          s.estado,
          s.url_retorno,
          s.expira_en,
          s.created_at,
          c.id AS cita_id,
          c.id_externo AS appointment_external_id
        FROM subastas s
        INNER JOIN citas c ON c.id = s.id_cita
        WHERE s.id = $1
        FOR UPDATE
      `,
      [auctionId]
    );

    if (auctionResult.rowCount === 0) {
      throw new Error('Subasta no encontrada');
    }

    const auction = auctionResult.rows[0];

    if (auction.estado !== 'activa') {
      throw new Error(`La subasta ya no está activa. Estado actual: ${auction.estado}`);
    }

    const participantResult = await client.query(
      `
        SELECT
          ps.id,
          ps.id_candidato_espera,
          ce.id_paciente,
          ce.nombre_visible
        FROM participantes_subasta ps
        INNER JOIN candidatos_espera ce
          ON ce.id = ps.id_candidato_espera
        WHERE ps.id_subasta = $1
          AND ce.id_paciente = $2
        FOR UPDATE
      `,
      [auctionId, patientId]
    );

    if (participantResult.rowCount === 0) {
      throw new Error('El paciente no participa en esta subasta');
    }

    const participant = participantResult.rows[0];

    const transactionResult = await client.query(
      `
        SELECT
          id,
          id_transaccion,
          id_correlacion,
          created_at
        FROM transacciones
        WHERE id_subasta = $1
        ORDER BY id ASC
        LIMIT 1
        FOR UPDATE
      `,
      [auctionId]
    );

    if (transactionResult.rowCount === 0) {
      throw new Error('No existe una transacción asociada a la subasta');
    }

    const transaction = transactionResult.rows[0];
    const reassignedAt = new Date();
    const elapsedMs = reassignedAt.getTime() - new Date(transaction.created_at).getTime();

    const responsePayload = {
      transaction_id: transaction.id_transaccion,
      correlation_id: transaction.id_correlacion,
      appointment_id: auction.appointment_external_id || appointmentId,
      status: 'reassigned',
      winner: {
        patient_id: patientId,
        display_name: participant.nombre_visible
      },
      reassigned_at: reassignedAt.toISOString(),
      elapsed_ms: elapsedMs
    };

    await client.query(
      `
        UPDATE subastas
        SET
          estado = 'reasignada',
          id_ganador_candidato = $2,
          confirmado_en = $3,
          updated_at = NOW()
        WHERE id = $1
      `,
      [auctionId, participant.id_candidato_espera, reassignedAt]
    );

    await client.query(
      `
        UPDATE participantes_subasta
        SET
          estado_respuesta = CASE
            WHEN id = $2 THEN 'ganador'
            ELSE 'perdedor'
          END,
          respondido_en = CASE
            WHEN id = $2 THEN $3
            ELSE respondido_en
          END,
          updated_at = NOW()
        WHERE id_subasta = $1
      `,
      [auctionId, participant.id, reassignedAt]
    );

    await client.query(
      `
        UPDATE transacciones
        SET
          estado = 'reasignado',
          payload_respuesta = $2::jsonb,
          reasignado_en = $3,
          tiempo_transcurrido_ms = $4,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        transaction.id,
        JSON.stringify(responsePayload),
        reassignedAt,
        elapsedMs
      ]
    );

    await client.query('COMMIT');

    const returnEventResult = await sendReturnEventWithRetry({
      url: auction.url_retorno,
      payload: responsePayload,
      referenceId: transaction.id_transaccion
    });

    return {
      success: true,
      statusCode: 200,
      responsePayload,
      returnEvent: returnEventResult
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  resolveAuctionWinner
};