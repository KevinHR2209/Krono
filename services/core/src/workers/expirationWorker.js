const { getClient } = require('../config/database');

async function processExpiredAuctions() {
    const client = await getClient();
    try {
        // 1. Buscamos subastas activas cuyo tiempo ya pasó
        const expiredResult = await client.query(`
            SELECT 
                s.id as subasta_id, 
                s.cita_id, 
                t.id as transaccion_db_id,
                t.id_transaccion, 
                t.id_correlacion,
                c.identificador_cita_externa,
                so.url_webhook_respuesta
            FROM subastas s
            INNER JOIN transacciones t ON t.subasta_id = s.id
            INNER JOIN citas c ON s.cita_id = c.id
            INNER JOIN sistemas_origen so ON c.sistema_origen_id = so.id
            WHERE s.estado = 'activa' AND s.expira_en <= NOW()
        `);

        if (expiredResult.rowCount === 0) {
            return; // No hay subastas expiradas
        }

        const expiredAuctions = expiredResult.rows;
        console.log(`[Core Worker] Encontradas ${expiredAuctions.length} subastas expiradas. Procesando...`);

        for (const auction of expiredAuctions) {
            await client.query('BEGIN');

            try {
                // 2. Marcamos la subasta como expirada
                await client.query(
                    `UPDATE subastas SET estado = 'expirada', actualizado_en = NOW() WHERE id = $1`,
                    [auction.subasta_id]
                );

                // 3. Marcamos la cita original nuevamente como cancelada definitiva
                await client.query(
                    `UPDATE citas SET estado = 'cancelada' WHERE id = $1`,
                    [auction.cita_id]
                );

                // 4. Preparamos el payload de fracaso
                const responsePayload = {
                    transaction_id: auction.id_transaccion,
                    correlation_id: auction.id_correlacion,
                    appointment_id: auction.identificador_cita_externa,
                    status: 'expired',
                    message: 'El tiempo de la subasta se agotó y ningún candidato aceptó el cupo.'
                };

                // 5. Actualizamos la transacción
                await client.query(
                    `UPDATE transacciones 
                     SET estado = 'expirada', payload_respuesta = $1::jsonb 
                     WHERE id = $2`,
                    [JSON.stringify(responsePayload), auction.transaccion_db_id]
                );

                await client.query('COMMIT');

                // 6. Disparamos el webhook al cliente
                if (auction.url_webhook_respuesta) {
                    try {
                        // fetch nativo
                        await fetch(auction.url_webhook_respuesta, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(responsePayload)
                        });
                        console.log(`[Core Worker] Notificación de expiración enviada a ${auction.url_webhook_respuesta}`);
                    } catch (netError) {
                        console.error(`[Core Worker] Falló el envío del webhook de expiración: ${netError.message}`);
                    }
                }

            } catch (innerError) {
                await client.query('ROLLBACK');
                console.error(`[Core Worker] Error procesando subasta ${auction.subasta_id}:`, innerError);
            }
        }
    } catch (error) {
        console.error('[Core Worker] Error crítico en Worker de Expiración:', error);
    } finally {
        client.release();
    }
}

// Función para iniciar el bucle infinito
function startExpirationWorker() {
    console.log('[Core Worker] Iniciando Worker de Expiración (Ciclo: 10s)...');
    setInterval(processExpiredAuctions, 10000); // Revisa cada 10 segundos
}

module.exports = { startExpirationWorker, processExpiredAuctions };