const { Pool } = require('pg');

let pool;

const TEST = {
  sistemaOrigenId: null,
  citaId:          null,
  auctionId:       null,
  transactionId:   null,
  candidatoId:     null,
  participantId:   null,
  patientId:       'test-patient-integration-001',
  appointmentId:   'test-appointment-001'
};

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL
    || 'postgresql://krono_user:krono_password@localhost:5432/krono_db';
  jest.resetModules();

  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('SELECT 1');

  // Limpiar posibles restos de corridas anteriores
  await _cleanup();

  // 1. sistema_origen
  const so = await pool.query(`
    INSERT INTO sistemas_origen
      (identificador_sistema_origen, nombre, hash_api_key, url_webhook_respuesta)
    VALUES ('test-sistema-int-001', 'Test Sistema Int', 'hash-test-no-real', NULL)
    RETURNING id
  `);
  TEST.sistemaOrigenId = so.rows[0].id;

  // 2. cita
  const cita = await pool.query(`
    INSERT INTO citas
      (sistema_origen_id, identificador_cita_externa, cancelada_en,
       fecha_bloque, hora_inicio, hora_fin,
       nombre_doctor, especialidad, ubicacion,
       identificador_paciente_cancelado, nombre_paciente_cancelado)
    VALUES ($1, 'cita-ext-int-001', NOW(),
            '2026-07-01', '10:00', '10:30',
            'Dr. Test', 'Corte Clásico', 'Local 1',
            'pac-cancelado-001', 'Paciente Cancelado Test')
    RETURNING id
  `, [TEST.sistemaOrigenId]);
  TEST.citaId = cita.rows[0].id;

  // 3. candidato en lista de espera (FK requerida por participantes_subasta)
  const candidato = await pool.query(`
    INSERT INTO candidatos_lista_espera
      (cita_id, identificador_paciente, nombre_visible, telefono, historial_asistencia)
    VALUES ($1, $2, 'Test Paciente', '+56991234567', 0.800)
    RETURNING id
  `, [TEST.citaId, TEST.patientId]);
  TEST.candidatoId = candidato.rows[0].id;

  // 4. subasta activa
  const auction = await pool.query(`
    INSERT INTO subastas
      (cita_id, id_correlacion, id_transaccion, estado,
       cantidad_total_candidatos, expira_en)
    VALUES ($1, gen_random_uuid(), gen_random_uuid(), 'activa',
            5, NOW() + INTERVAL '5 minutes')
    RETURNING id, id_transaccion, id_correlacion
  `, [TEST.citaId]);
  TEST.auctionId     = auction.rows[0].id;
  TEST.idTransaccion = auction.rows[0].id_transaccion;
  TEST.idCorrelacion = auction.rows[0].id_correlacion;

  // 5. participante
  const part = await pool.query(`
    INSERT INTO participantes_subasta
      (subasta_id, candidato_lista_espera_id,
       identificador_paciente, nombre_visible, telefono,
       historial_asistencia,
       historial_asistencia_normalizado, distancia_normalizada,
       puntaje_prioridad, posicion_ranking)
    VALUES ($1, $2,
            $3, 'Test Paciente', '+56991234567',
            0.800, 0.80000, 0.00000, 0.48000, 1)
    RETURNING id
  `, [TEST.auctionId, TEST.candidatoId, TEST.patientId]);
  TEST.participantId = part.rows[0].id;

  // 6. transacción
  const tx = await pool.query(`
    INSERT INTO transacciones
      (id_transaccion, id_correlacion, subasta_id, cita_id, sistema_origen_id,
       estado, payload_respuesta, tiempo_transcurrido_ms)
    VALUES ($1, $2, $3, $4, $5,
            'reasignada', '{}', 0)
    RETURNING id
  `, [TEST.idTransaccion, TEST.idCorrelacion,
      TEST.auctionId, TEST.citaId, TEST.sistemaOrigenId]);
  TEST.transactionId = tx.rows[0].id;
});

afterAll(async () => {
  await _cleanup();
  if (pool) await pool.end();
});

// Limpia en orden respetando FK
async function _cleanup() {
  await pool.query(`DELETE FROM transacciones        WHERE id_transaccion::text LIKE 'test-%' OR sistema_origen_id IN (SELECT id FROM sistemas_origen WHERE identificador_sistema_origen = 'test-sistema-int-001')`).catch(() => {});
  await pool.query(`DELETE FROM participantes_subasta WHERE identificador_paciente = 'test-patient-integration-001'`).catch(() => {});
  await pool.query(`DELETE FROM subastas              WHERE cita_id IN (SELECT id FROM citas WHERE identificador_cita_externa = 'cita-ext-int-001')`).catch(() => {});
  await pool.query(`DELETE FROM candidatos_lista_espera WHERE identificador_paciente = 'test-patient-integration-001'`).catch(() => {});
  await pool.query(`DELETE FROM citas                 WHERE identificador_cita_externa = 'cita-ext-int-001'`).catch(() => {});
  await pool.query(`DELETE FROM sistemas_origen       WHERE identificador_sistema_origen = 'test-sistema-int-001'`).catch(() => {});
}

// ─── Tests ────────────────────────────────────────────────────
describe('[Integration] resolveAuctionWinner', () => {

  test('retorna success: true con los datos correctos', async () => {
    jest.resetModules();
    const { resolveAuctionWinner } = require('../../services/auctionResolver');

    const result = await resolveAuctionWinner({
      auctionId:     TEST.auctionId,
      patientId:     TEST.patientId,
      appointmentId: TEST.appointmentId
    });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.responsePayload.status).toBe('reassigned');
    expect(result.responsePayload.winner.patient_id).toBe(TEST.patientId);
    expect(result.responsePayload.winner.display_name).toBe('Test Paciente');
  });

  test('la subasta queda con estado "ganada" en la BD', async () => {
    const { rows } = await pool.query(
      'SELECT estado FROM subastas WHERE id = $1', [TEST.auctionId]
    );
    expect(rows[0].estado).toBe('ganada');
  });

  test('el participante ganador queda con estado "ganador" en la BD', async () => {
    const { rows } = await pool.query(
      'SELECT estado FROM participantes_subasta WHERE id = $1', [TEST.participantId]
    );
    expect(rows[0].estado).toBe('ganador');
  });

  test('la transacción queda con estado "reasignada" y payload correcto', async () => {
    const { rows } = await pool.query(
      'SELECT estado, payload_respuesta FROM transacciones WHERE id = $1',
      [TEST.transactionId]
    );
    expect(rows[0].estado).toBe('reasignada');
    expect(rows[0].payload_respuesta.status).toBe('reassigned');
    expect(rows[0].payload_respuesta.winner.patient_id).toBe(TEST.patientId);
  });

  test('elapsed_ms es un número >= 0', async () => {
    const { rows } = await pool.query(
      'SELECT tiempo_transcurrido_ms FROM subastas WHERE id = $1', [TEST.auctionId]
    );
    expect(rows[0].tiempo_transcurrido_ms).toBeGreaterThanOrEqual(0);
  });

  test('subasta ya ganada → lanza error', async () => {
    jest.resetModules();
    const { resolveAuctionWinner } = require('../../services/auctionResolver');

    await expect(
      resolveAuctionWinner({
        auctionId:     TEST.auctionId,
        patientId:     TEST.patientId,
        appointmentId: TEST.appointmentId
      })
    ).rejects.toThrow();
  });

  test('auctionId inexistente → lanza error', async () => {
    jest.resetModules();
    const { resolveAuctionWinner } = require('../../services/auctionResolver');

    await expect(
      resolveAuctionWinner({
        auctionId:     '00000000-0000-0000-0000-000000000000',
        patientId:     TEST.patientId,
        appointmentId: TEST.appointmentId
      })
    ).rejects.toThrow();
  });

  test('paciente que no participa → lanza error', async () => {
    jest.resetModules();
    const { resolveAuctionWinner } = require('../../services/auctionResolver');

    await expect(
      resolveAuctionWinner({
        auctionId:     TEST.auctionId,
        patientId:     'paciente-fantasma-99999',
        appointmentId: TEST.appointmentId
      })
    ).rejects.toThrow();
  });
});