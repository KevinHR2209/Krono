const { v4: uuidv4 } = require('uuid');
const { getClient } = require('../config/database');
const { notificationQueue } = require('../config/queue');
const { rankCandidates, selectTopCandidates, FALLBACK_WEIGHTS } = require('./smartQueue');

async function ensureSourceSystem(client, payload) {
    const existing = await client.query(
        `SELECT id, identificador_sistema_origen, nombre, url_webhook_respuesta
         FROM sistemas_origen
         WHERE identificador_sistema_origen = $1 LIMIT 1`,
        [payload.source_system_id]
    );

    if (existing.rows.length > 0) {
        const sys = existing.rows[0];
        if (payload.return_url && sys.url_webhook_respuesta !== payload.return_url) {
            await client.query(
                `UPDATE sistemas_origen SET url_webhook_respuesta = $1 WHERE id = $2`,
                [payload.return_url, sys.id]
            );
            sys.url_webhook_respuesta = payload.return_url;
        }
        return sys;
    }

    const inserted = await client.query(
        `INSERT INTO sistemas_origen (
            identificador_sistema_origen, nombre, dominio, hash_api_key, correo_contacto, url_webhook_respuesta, activo
        ) VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id, identificador_sistema_origen, nombre, url_webhook_respuesta`,
        [payload.source_system_id, payload.source_system_id, null, 'bootstrap-api-key-hash', null, payload.return_url || null]
    );
    return inserted.rows[0];
}

// Extraer la configuración JSON y tiempos del cliente
async function getActiveConfig(client, sistemaOrigenId) {
    const result = await client.query(
        `SELECT pesos, tiempo_expiracion_segundos, cantidad_notificar
         FROM configuracion_pesos
         WHERE sistema_origen_id = $1 AND activo = TRUE
         ORDER BY vigente_desde DESC LIMIT 1`,
        [sistemaOrigenId]
    );

    if (result.rows.length > 0) {
        return result.rows[0];
    }
    return { pesos: FALLBACK_WEIGHTS, tiempo_expiracion_segundos: 120, cantidad_notificar: 5 };
}

async function ensureAppointment(client, sistemaOrigenId, payload) {
    const existing = await client.query(
        `SELECT id FROM citas WHERE sistema_origen_id = $1 AND identificador_cita_externa = $2 LIMIT 1`,
        [sistemaOrigenId, payload.cancellation.appointment_id]
    );
    if (existing.rows.length > 0) return existing.rows[0].id;

    const inserted = await client.query(
        `INSERT INTO citas (
            sistema_origen_id, identificador_cita_externa, cancelada_en, fecha_bloque,
            hora_inicio, hora_fin, nombre_doctor, especialidad, ubicacion,
            identificador_paciente_cancelado, nombre_paciente_cancelado, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'cancelada') RETURNING id`,
        [
            sistemaOrigenId, payload.cancellation.appointment_id, payload.cancellation.cancelled_at,
            payload.cancellation.slot.date, payload.cancellation.slot.start_time, payload.cancellation.slot.end_time,
            payload.cancellation.slot.doctor_name, payload.cancellation.slot.specialty, payload.cancellation.slot.location,
            payload.cancellation.cancelled_patient.patient_id, payload.cancellation.cancelled_patient.display_name
        ]
    );
    return inserted.rows[0].id;
}

async function createAuction({ payload, correlationId }) {
    const client = await getClient();
    const transactionId = uuidv4();

    try {
        await client.query('BEGIN');

        const sourceSystem = await ensureSourceSystem(client, payload);
        const citaId = await ensureAppointment(client, sourceSystem.id, payload);

        // Obtenemos los pesos y la configuración justo antes de la subasta
        const activeConfig = await getActiveConfig(client, sourceSystem.id);

        const shopLat = payload.cancellation.slot.latitud || null;
        const shopLon = payload.cancellation.slot.longitud || null;

        // Inyectamos el JSON activo a la función de ranking
        const rankedCandidates = rankCandidates(payload.waitlist, shopLat, shopLon, activeConfig.pesos);

        // CORTAMOS LA LISTA SEGÚN LA CONFIGURACIÓN DEL NEGOCIO
        const topCandidates = rankedCandidates.slice(0, activeConfig.cantidad_notificar);

        await client.query(`UPDATE citas SET estado = 'subasta_pendiente' WHERE id = $1`, [citaId]);

        // INYECTAMOS EL TIEMPO DE EXPIRACIÓN DEL NEGOCIO
        const subastaInsert = await client.query(
            `INSERT INTO subastas (
                cita_id, id_correlacion, id_transaccion, estado, cantidad_top_candidatos, cantidad_total_candidatos, iniciada_en, expira_en
            ) VALUES ($1, $2, $3, 'activa', $4, $5, NOW(), NOW() + ($6 * INTERVAL '1 second')) RETURNING id, iniciada_en, expira_en`,
            [citaId, correlationId, transactionId, topCandidates.length, rankedCandidates.length, activeConfig.tiempo_expiracion_segundos]
        );

        const subasta = subastaInsert.rows[0];

        for (const candidate of rankedCandidates) {
            // MAGIA: Convertimos el diccionario metrics en un string JSON
            const stringMetricas = JSON.stringify(candidate.metrics || {});

            const candidatoInsert = await client.query(
                `INSERT INTO candidatos_lista_espera (
                    cita_id, identificador_paciente, nombre_visible, telefono, metricas, latitud, longitud
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (cita_id, identificador_paciente) DO UPDATE SET
                    nombre_visible = EXCLUDED.nombre_visible, telefono = EXCLUDED.telefono,
                                                                          metricas = EXCLUDED.metricas, latitud = EXCLUDED.latitud, longitud = EXCLUDED.longitud
                                                                          RETURNING id`,
                [citaId, candidate.patient_id, candidate.display_name, candidate.phone, stringMetricas, candidate.latitud || null, candidate.longitud || null]
            );

            const candidatoListaEsperaId = candidatoInsert.rows[0].id;
            const estadoParticipante = candidate.posicion_ranking <= activeConfig.cantidad_notificar ? 'notificado' : 'rankeado';

            await client.query(
                `INSERT INTO participantes_subasta (
                    subasta_id, candidato_lista_espera_id, identificador_paciente, nombre_visible, telefono, metricas,
                    latitud, longitud, distancia_km, distancia_normalizada, puntaje_prioridad, posicion_ranking, estado, notificado_en
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::estado_participante_enum, CASE WHEN $13::estado_participante_enum = 'notificado'::estado_participante_enum THEN NOW() ELSE NULL END)`,
                [
                    subasta.id,
                    candidatoListaEsperaId,
                    candidate.patient_id,
                    candidate.display_name,
                    candidate.phone,
                    stringMetricas,
                    candidate.latitud || null,
                    candidate.longitud || null,
                    candidate.distancia_km,
                    candidate.distancia_normalizada,
                    candidate.puntaje_prioridad,
                    candidate.posicion_ranking,
                    estadoParticipante
                ]
            );
        }

        const payloadRespuestaInicial = {
            transaction_id: transactionId, correlation_id: correlationId, appointment_id: payload.cancellation.appointment_id,
            status: 'pending', winner: null, reassigned_at: null, elapsed_ms: 0
        };

        await client.query(
            `INSERT INTO transacciones (
                id_transaccion, id_correlacion, subasta_id, cita_id, sistema_origen_id, estado, participante_ganador_id,
                identificador_paciente_ganador, nombre_visible_ganador, payload_respuesta, intentos_retorno, tiempo_transcurrido_ms
            ) VALUES ($1, $2, $3, $4, $5, 'fallida', NULL, NULL, NULL, $6::jsonb, 0, 0)`,
            [transactionId, correlationId, subasta.id, citaId, sourceSystem.id, JSON.stringify(payloadRespuestaInicial)]
        );

        await client.query('COMMIT');

        await notificationQueue.add('dispatch-top-candidates', {
            auction_id: subasta.id, correlation_id: correlationId, transaction_id: transactionId, appointment_id: payload.cancellation.appointment_id,
            source_system_id: payload.source_system_id, slot: payload.cancellation.slot, cancellation: payload.cancellation,
            top_candidates: topCandidates, ranked_candidates: rankedCandidates, expires_at: subasta.expira_en, weights: activeConfig.pesos
        });

        return {
            auction_id: subasta.id, correlation_id: correlationId, transaction_id: transactionId, appointment_id: payload.cancellation.appointment_id,
            status: 'pending', ranked_candidates: rankedCandidates, top_candidates: topCandidates, expires_at: subasta.expira_en
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { createAuction };