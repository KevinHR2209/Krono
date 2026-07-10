jest.mock('../../config/database', () => ({
  getClient: jest.fn()
}));

const { getClient } = require('../../config/database');
const { processExpiredAuctions } = require('../../workers/expirationWorker');

function buildMockClient({ expiredRows = [] } = {}) {
  const calls = [];
  const query = jest.fn(async (sql, params = []) => {
    calls.push({ sql, params });
    const s = sql.replace(/\s+/g, ' ').trim();

    if (s.startsWith('BEGIN') || s.startsWith('COMMIT') || s.startsWith('ROLLBACK')) {
      return {};
    }

    if (s.includes("WHERE s.estado = 'activa' AND s.expira_en <= NOW()")) {
      return { rowCount: expiredRows.length, rows: expiredRows };
    }

    if (s.startsWith("UPDATE subastas SET estado = 'expirada'")) {
      return {};
    }

    if (s.startsWith("UPDATE citas SET estado = 'cancelada'")) {
      return {};
    }

    if (s.startsWith("UPDATE transacciones")) {
      return {};
    }

    throw new Error(`Query no manejada por el mock: ${s}`);
  });

  return { query, release: jest.fn(), _calls: calls };
}

const makeExpiredAuction = (overrides = {}) => ({
  subasta_id: 1,
  cita_id: 10,
  transaccion_db_id: 100,
  id_transaccion: 'tx-abc',
  id_correlacion: 'corr-abc',
  identificador_cita_externa: 'apt-001',
  url_webhook_respuesta: 'https://clinica-demo.cl/webhook/respuesta',
  ...overrides
});

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

describe('processExpiredAuctions', () => {
  test('no ejecuta ningún UPDATE si no hay subastas expiradas', async () => {
    const mockClient = buildMockClient({ expiredRows: [] });
    getClient.mockResolvedValue(mockClient);

    await processExpiredAuctions();

    const updates = mockClient._calls.filter((c) => c.sql.trim().startsWith('UPDATE'));
    expect(updates).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('marca la subasta como expirada y la cita como cancelada', async () => {
    const mockClient = buildMockClient({ expiredRows: [makeExpiredAuction()] });
    getClient.mockResolvedValue(mockClient);

    await processExpiredAuctions();

    const subastaUpdate = mockClient._calls.find((c) => c.sql.startsWith("UPDATE subastas SET estado = 'expirada'"));
    const citaUpdate = mockClient._calls.find((c) => c.sql.startsWith("UPDATE citas SET estado = 'cancelada'"));
    expect(subastaUpdate).toBeDefined();
    expect(subastaUpdate.params[0]).toBe(1);
    expect(citaUpdate).toBeDefined();
    expect(citaUpdate.params[0]).toBe(10);
  });

  test('hace COMMIT antes de disparar el webhook al cliente', async () => {
    const mockClient = buildMockClient({ expiredRows: [makeExpiredAuction()] });
    getClient.mockResolvedValue(mockClient);

    await processExpiredAuctions();

    const commitIndex = mockClient._calls.findIndex((c) => c.sql.trim() === 'COMMIT');
    expect(commitIndex).toBeGreaterThan(-1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://clinica-demo.cl/webhook/respuesta',
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('no dispara webhook si el sistema origen no tiene url_webhook_respuesta', async () => {
    const mockClient = buildMockClient({
      expiredRows: [makeExpiredAuction({ url_webhook_respuesta: null })]
    });
    getClient.mockResolvedValue(mockClient);

    await processExpiredAuctions();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('el payload del webhook trae status "expired" y el appointment_id correcto', async () => {
    const mockClient = buildMockClient({ expiredRows: [makeExpiredAuction()] });
    getClient.mockResolvedValue(mockClient);

    await processExpiredAuctions();

    const [, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.status).toBe('expired');
    expect(body.appointment_id).toBe('apt-001');
    expect(body.transaction_id).toBe('tx-abc');
  });

  test('si el fetch del webhook falla, no revierte la transacción ya commiteada', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Timeout de red'));
    const mockClient = buildMockClient({ expiredRows: [makeExpiredAuction()] });
    getClient.mockResolvedValue(mockClient);

    await expect(processExpiredAuctions()).resolves.not.toThrow();

    const commitCall = mockClient._calls.find((c) => c.sql.trim() === 'COMMIT');
    const rollbackCall = mockClient._calls.find((c) => c.sql.trim() === 'ROLLBACK');
    expect(commitCall).toBeDefined();
    expect(rollbackCall).toBeUndefined();
  });

  test('procesa varias subastas expiradas en la misma corrida', async () => {
    const mockClient = buildMockClient({
      expiredRows: [
        makeExpiredAuction({ subasta_id: 1, cita_id: 10 }),
        makeExpiredAuction({ subasta_id: 2, cita_id: 20 })
      ]
    });
    getClient.mockResolvedValue(mockClient);

    await processExpiredAuctions();

    const subastaUpdates = mockClient._calls.filter((c) => c.sql.startsWith("UPDATE subastas SET estado = 'expirada'"));
    expect(subastaUpdates).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('si una subasta falla internamente, hace ROLLBACK solo de esa y sigue con las demás', async () => {
    const mockClient = buildMockClient({
      expiredRows: [
        makeExpiredAuction({ subasta_id: 1, cita_id: 10 }),
        makeExpiredAuction({ subasta_id: 2, cita_id: 20 })
      ]
    });
    // La primera UPDATE subastas falla, el resto sigue funcionando normal
    let subastaUpdateCount = 0;
    mockClient.query.mockImplementation(async (sql, params = []) => {
      mockClient._calls.push({ sql, params });
      const s = sql.replace(/\s+/g, ' ').trim();

      if (s.startsWith('BEGIN') || s.startsWith('COMMIT') || s.startsWith('ROLLBACK')) return {};
      if (s.includes("WHERE s.estado = 'activa' AND s.expira_en <= NOW()")) {
        return { rowCount: 2, rows: [
          makeExpiredAuction({ subasta_id: 1, cita_id: 10 }),
          makeExpiredAuction({ subasta_id: 2, cita_id: 20 })
        ] };
      }
      if (s.startsWith("UPDATE subastas SET estado = 'expirada'")) {
        subastaUpdateCount += 1;
        if (subastaUpdateCount === 1) throw new Error('Fallo simulado en la primera subasta');
        return {};
      }
      if (s.startsWith("UPDATE citas SET estado = 'cancelada'")) return {};
      if (s.startsWith('UPDATE transacciones')) return {};
      throw new Error(`Query no manejada: ${s}`);
    });

    getClient.mockResolvedValue(mockClient);

    await expect(processExpiredAuctions()).resolves.not.toThrow();

    // La segunda subasta sí debe haber llegado a disparar su webhook
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('siempre libera el cliente (release) aunque no haya subastas expiradas', async () => {
    const mockClient = buildMockClient({ expiredRows: [] });
    getClient.mockResolvedValue(mockClient);

    await processExpiredAuctions();

    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});
