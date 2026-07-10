jest.mock('../../config/database', () => ({
  getClient: jest.fn()
}));

jest.mock('../../config/queue', () => ({
  notificationQueue: { add: jest.fn().mockResolvedValue(undefined) }
}));

const { getClient } = require('../../config/database');
const { notificationQueue } = require('../../config/queue');
const { createAuction } = require('../../services/auctionService');

// ─── Helper: cliente pg simulado ───────────────────────────────
// Responde según el SQL involucrado, sin depender del orden exacto de llamadas.
function buildMockClient(overrides = {}) {
  let candidatoId = 0;
  const calls = [];

  const query = jest.fn(async (sql, params = []) => {
    calls.push({ sql, params });
    const s = sql.replace(/\s+/g, ' ').trim();

    if (s.startsWith('BEGIN') || s.startsWith('COMMIT') || s.startsWith('ROLLBACK')) {
      return {};
    }

    if (s.includes('FROM sistemas_origen')) {
      return overrides.existingSourceSystem
        ? { rows: [overrides.existingSourceSystem] }
        : { rows: [] };
    }

    if (s.startsWith('INSERT INTO sistemas_origen')) {
      return {
        rows: [
          {
            id: 1,
            identificador_sistema_origen: params[0],
            nombre: params[1],
            url_webhook_respuesta: params[5]
          }
        ]
      };
    }

    if (s.startsWith('UPDATE sistemas_origen')) {
      return { rows: [] };
    }

    if (s.startsWith('SELECT id FROM citas')) {
      return overrides.existingAppointmentId
        ? { rows: [{ id: overrides.existingAppointmentId }] }
        : { rows: [] };
    }

    if (s.startsWith('INSERT INTO citas')) {
      return { rows: [{ id: 100 }] };
    }

    if (s.includes('FROM configuracion_pesos')) {
      return overrides.activeConfig ? { rows: [overrides.activeConfig] } : { rows: [] };
    }

    if (s.startsWith("UPDATE citas SET estado = 'subasta_pendiente'")) {
      return {};
    }

    if (s.startsWith('INSERT INTO subastas')) {
      return {
        rows: [
          { id: 500, iniciada_en: new Date(), expira_en: new Date(Date.now() + 120000) }
        ]
      };
    }

    if (s.startsWith('INSERT INTO candidatos_lista_espera')) {
      candidatoId += 1;
      return { rows: [{ id: candidatoId }] };
    }

    if (s.startsWith('INSERT INTO participantes_subasta')) {
      return {};
    }

    if (s.startsWith('INSERT INTO transacciones')) {
      return {};
    }

    throw new Error(`Query no manejada por el mock: ${s}`);
  });

  return { query, release: jest.fn(), _calls: calls };
}

const basePayload = (overrides = {}) => ({
  source_system_id: 'clinica-demo',
  return_url: 'https://clinica-demo.cl/webhook/respuesta',
  cancellation: {
    appointment_id: 'apt-001',
    cancelled_at: '2026-07-10T15:00:00.000Z',
    slot: {
      date: '2026-07-11',
      start_time: '09:00',
      end_time: '09:30',
      doctor_name: 'Dra. Pérez',
      specialty: 'Odontología',
      location: 'Sucursal Centro',
      latitud: -33.4489,
      longitud: -70.6693
    },
    cancelled_patient: { patient_id: 'pac-999', display_name: 'Paciente Cancelado' }
  },
  waitlist: [
    { patient_id: 'pac-001', display_name: 'Juan Pérez', phone: '+56911111111', metrics: { attendance_history: 0.9 } },
    { patient_id: 'pac-002', display_name: 'Ana Soto', phone: '+56922222222', metrics: { attendance_history: 0.5 } },
    { patient_id: 'pac-003', display_name: 'Luis Rojas', phone: '+56933333333', metrics: { attendance_history: 0.2 } }
  ],
  ...overrides
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createAuction', () => {
  test('crea sistema_origen nuevo si no existe (INSERT en vez de solo SELECT)', async () => {
    const mockClient = buildMockClient();
    getClient.mockResolvedValue(mockClient);

    await createAuction({ payload: basePayload(), correlationId: 'corr-1' });

    const insertSourceSystem = mockClient._calls.find((c) => c.sql.includes('INSERT INTO sistemas_origen'));
    expect(insertSourceSystem).toBeDefined();
  });

  test('reutiliza sistema_origen existente sin insertar uno nuevo', async () => {
    const mockClient = buildMockClient({
      existingSourceSystem: {
        id: 42,
        identificador_sistema_origen: 'clinica-demo',
        nombre: 'clinica-demo',
        url_webhook_respuesta: 'https://clinica-demo.cl/webhook/respuesta'
      }
    });
    getClient.mockResolvedValue(mockClient);

    await createAuction({ payload: basePayload(), correlationId: 'corr-2' });

    const insertSourceSystem = mockClient._calls.find((c) => c.sql.includes('INSERT INTO sistemas_origen'));
    expect(insertSourceSystem).toBeUndefined();
  });

  test('actualiza url_webhook_respuesta si el sistema existente trae una distinta', async () => {
    const mockClient = buildMockClient({
      existingSourceSystem: {
        id: 42,
        identificador_sistema_origen: 'clinica-demo',
        nombre: 'clinica-demo',
        url_webhook_respuesta: 'https://viejo-dominio.cl/webhook'
      }
    });
    getClient.mockResolvedValue(mockClient);

    await createAuction({ payload: basePayload(), correlationId: 'corr-3' });

    const updateCall = mockClient._calls.find((c) => c.sql.startsWith('UPDATE sistemas_origen'));
    expect(updateCall).toBeDefined();
    expect(updateCall.params[0]).toBe('https://clinica-demo.cl/webhook/respuesta');
  });

  test('usa FALLBACK_WEIGHTS y valores por defecto si no hay configuración activa', async () => {
    const mockClient = buildMockClient(); // sin activeConfig
    getClient.mockResolvedValue(mockClient);

    const result = await createAuction({ payload: basePayload(), correlationId: 'corr-4' });

    // Con cantidad_notificar por defecto (5) y 3 candidatos, todos entran al top
    expect(result.top_candidates).toHaveLength(3);
  });

  test('respeta cantidad_notificar de la configuración activa al recortar el top', async () => {
    const mockClient = buildMockClient({
      activeConfig: { pesos: { attendance_history: 1 }, tiempo_expiracion_segundos: 60, cantidad_notificar: 2 }
    });
    getClient.mockResolvedValue(mockClient);

    const result = await createAuction({ payload: basePayload(), correlationId: 'corr-5' });

    expect(result.top_candidates).toHaveLength(2);
    expect(result.ranked_candidates).toHaveLength(3);
  });

  test('asigna estado notificado solo a los primeros N según cantidad_notificar', async () => {
    const mockClient = buildMockClient({
      activeConfig: { pesos: { attendance_history: 1 }, tiempo_expiracion_segundos: 60, cantidad_notificar: 1 }
    });
    getClient.mockResolvedValue(mockClient);

    await createAuction({ payload: basePayload(), correlationId: 'corr-6' });

    const participantInserts = mockClient._calls.filter((c) => c.sql.startsWith('INSERT INTO participantes_subasta'));
    expect(participantInserts).toHaveLength(3);

    // El último parámetro es el estado (antes del CASE), penúltimo índice
    const estados = participantInserts.map((c) => c.params[12]);
    const notificados = estados.filter((e) => e === 'notificado');
    const rankeados = estados.filter((e) => e === 'rankeado');
    expect(notificados).toHaveLength(1);
    expect(rankeados).toHaveLength(2);
  });

  test('no crea una cita nueva si ya existe para el mismo sistema_origen + appointment externo', async () => {
    const mockClient = buildMockClient({ existingAppointmentId: 777 });
    getClient.mockResolvedValue(mockClient);

    await createAuction({ payload: basePayload(), correlationId: 'corr-7' });

    const insertCita = mockClient._calls.find((c) => c.sql.startsWith('INSERT INTO citas'));
    expect(insertCita).toBeUndefined();
  });

  test('hace COMMIT y encola la notificación cuando todo sale bien', async () => {
    const mockClient = buildMockClient();
    getClient.mockResolvedValue(mockClient);

    await createAuction({ payload: basePayload(), correlationId: 'corr-8' });

    const commitCall = mockClient._calls.find((c) => c.sql.trim() === 'COMMIT');
    expect(commitCall).toBeDefined();
    expect(notificationQueue.add).toHaveBeenCalledTimes(1);
    expect(notificationQueue.add).toHaveBeenCalledWith(
      'dispatch-top-candidates',
      expect.objectContaining({ correlation_id: 'corr-8', appointment_id: 'apt-001' })
    );
  });

  test('hace ROLLBACK y propaga el error si una query intermedia falla', async () => {
    const mockClient = buildMockClient();
    mockClient.query.mockImplementationOnce(() => Promise.resolve({})); // BEGIN
    // Forzamos que la siguiente query (sistemas_origen) explote
    mockClient.query.mockImplementationOnce(() => {
      throw new Error('Fallo simulado de conexión a BD');
    });

    getClient.mockResolvedValue(mockClient);

    await expect(
      createAuction({ payload: basePayload(), correlationId: 'corr-9' })
    ).rejects.toThrow('Fallo simulado de conexión a BD');

    const rollbackCall = mockClient._calls.find((c) => c.sql.trim() === 'ROLLBACK');
    expect(rollbackCall).toBeDefined();
    expect(notificationQueue.add).not.toHaveBeenCalled();
  });

  test('siempre libera el cliente (release) incluso si la transacción falla', async () => {
    const mockClient = buildMockClient();
    mockClient.query.mockImplementationOnce(() => Promise.resolve({})); // BEGIN
    mockClient.query.mockImplementationOnce(() => {
      throw new Error('Fallo simulado');
    });

    getClient.mockResolvedValue(mockClient);

    await expect(
      createAuction({ payload: basePayload(), correlationId: 'corr-10' })
    ).rejects.toThrow();

    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  test('libera el cliente también en el camino feliz', async () => {
    const mockClient = buildMockClient();
    getClient.mockResolvedValue(mockClient);

    await createAuction({ payload: basePayload(), correlationId: 'corr-11' });

    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  test('el ranking recibido en la notificación viene ordenado por puntaje_prioridad', async () => {
    const mockClient = buildMockClient({
      activeConfig: { pesos: { attendance_history: 1 }, tiempo_expiracion_segundos: 60, cantidad_notificar: 5 }
    });
    getClient.mockResolvedValue(mockClient);

    const result = await createAuction({ payload: basePayload(), correlationId: 'corr-12' });

    const scores = result.ranked_candidates.map((c) => c.puntaje_prioridad);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });
});
