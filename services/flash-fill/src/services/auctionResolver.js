const { getClient } = require('../config/database');
// const { sendReturnEventWithRetry } = require('./returnEvent');

async function resolveAuctionWinner({ auctionId, patientId, appointmentId }) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

  const auctionResult = await client.query(
    `
      SELECT
        s.id,
        s.cita_id,
        s.id_correlacion,
        s.id_transaccion,
        s.estado,
        s.expira_en,
        s.creado_en,
        c.id AS cita_id_real
      FROM subastas s
      INNER JOIN citas c ON c.id = s.cita_id
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
        ps.candidato_lista_espera_id,
        ps.identificador_paciente,
        ps.nombre_visible
      FROM participantes_subasta ps
      WHERE ps.subasta_id = $1
        AND ps.identificador_paciente = $2
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
          creado_en
        FROM transacciones
        WHERE subasta_id = $1
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
    const elapsedMs = reassignedAt.getTime() - new Date(transaction.creado_en).getTime();

    const responsePayload = {
      transaction_id: transaction.id_transaccion,
      correlation_id: transaction.id_correlacion,
      appointment_id: appointmentId || auction.cita_id_real,
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
      estado = 'ganada',
      participante_ganador_id = $2,
      identificador_paciente_ganador = $3,
      nombre_visible_ganador = $4,
      resuelta_en = $5,
      tiempo_transcurrido_ms = $6,
      actualizado_en = NOW()
    WHERE id = $1
  `,
  [
    auctionId,
    participant.id,
    patientId,
    participant.nombre_visible,
    reassignedAt,
    elapsedMs
  ]
);

    await client.query(
      `
        UPDATE participantes_subasta
        SET
          estado = (
            CASE
              WHEN id = $2 THEN 'ganador'
              ELSE 'perdedor'
            END
          )::estado_participante_enum,
          respondido_en = CASE
            WHEN id = $2 THEN $3
            ELSE respondido_en
          END,
          actualizado_en = NOW()
        WHERE subasta_id = $1
      `,
      [auctionId, participant.id, reassignedAt]
    );

await client.query(
  `
    UPDATE transacciones
    SET
      estado = 'reasignada',
      participante_ganador_id = $2,
      identificador_paciente_ganador = $3,
      nombre_visible_ganador = $4,
      payload_respuesta = $5::jsonb,
      reasignada_en = $6,
      tiempo_transcurrido_ms = $7,
      ultimo_intento_retorno_en = NOW()
    WHERE id = $1
  `,
  [
    transaction.id,
    participant.id,
    patientId,
    participant.nombre_visible,
    JSON.stringify(responsePayload),
    reassignedAt,
    elapsedMs
  ]
);

    await client.query('COMMIT');

    return {
      success: true,
      statusCode: 200,
      responsePayload,
      returnEvent: {
        skipped: true,
        reason: 'url_retorno no disponible en el esquema actual'
      }
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