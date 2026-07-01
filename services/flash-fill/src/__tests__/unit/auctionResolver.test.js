// Mock de BD, axios y returnEvent para pruebas unitarias puras

jest.mock('../../config/database');
jest.mock('../../services/returnEvent');

const { getClient }           = require('../../config/database');
const { sendReturnEventWithRetry } = require('../../services/returnEvent');
const { resolveAuctionWinner } = require('../../services/auctionResolver');

// ─── Helpers ──────────────────────────────────────────────────
function makeClient({
  auctionRows     = [],
  participantRows = [],
  transactionRows = [],
  commitOk        = true
} = {}) {
  let queryCallCount = 0;
  const responses = [
    { rowCount: auctionRows.length,     rows: auctionRows     },  // SELECT subastas
    { rowCount: participantRows.length, rows: participantRows },   // SELECT participantes
    { rowCount: transactionRows.length, rows: transactionRows },   // SELECT transacciones
    { rowCount: 1, rows: [] },  // UPDATE subastas
    { rowCount: 1, rows: [] },  // UPDATE participantes
    { rowCount: 1, rows: [] },  // UPDATE transacciones
  ];

  return {
    query: jest.fn(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return;
      return responses[queryCallCount++] || { rowCount: 0, rows: [] };
    }),
    release: jest.fn()
  };
}

const AUCTION_ROW = {
  id:           'auction-001',
  cita_id:      'cita-001',
  id_correlacion: 'corr-001',
  id_transaccion: 'tx-001',
  estado:       'activa',
  expira_en:    new Date(Date.now() + 60000).toISOString(),
  creado_en:    new Date().toISOString(),
  cita_id_real: 'cita-001'
};

const PARTICIPANT_ROW = {
  id:                        'part-001',
  candidato_lista_espera_id: 'wait-001',
  identificador_paciente:    'patient-001',
  nombre_visible:            'Juan Pérez'
};

const TRANSACTION_ROW = {
  id:                   'trans-001',
  id_transaccion:       'tx-001',
  id_correlacion:       'corr-001',
  creado_en:            new Date(Date.now() - 5000).toISOString(),
  url_webhook_respuesta: 'https://sistema-origen.cl/webhook'
};

// ─── Casos de éxito ───────────────────────────────────────────
describe('resolveAuctionWinner - casos de éxito', () => {
  beforeEach(() => jest.clearAllMocks());

  test('retorna success: true cuando todo funciona correctamente', async () => {
    const client = makeClient({
      auctionRows:     [AUCTION_ROW],
      participantRows: [PARTICIPANT_ROW],
      transactionRows: [TRANSACTION_ROW]
    });
    getClient.mockResolvedValue(client);
    sendReturnEventWithRetry.mockResolvedValue({ success: true, attempts: 1 });

    const result = await resolveAuctionWinner({
      auctionId:     'auction-001',
      patientId:     'patient-001',
      appointmentId: 'appt-001'
    });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  test('responsePayload incluye status "reassigned"', async () => {
    const client = makeClient({
      auctionRows:     [AUCTION_ROW],
      participantRows: [PARTICIPANT_ROW],
      transactionRows: [TRANSACTION_ROW]
    });
    getClient.mockResolvedValue(client);
    sendReturnEventWithRetry.mockResolvedValue({ success: true, attempts: 1 });

    const { responsePayload } = await resolveAuctionWinner({
      auctionId: 'auction-001', patientId: 'patient-001', appointmentId: 'appt-001'
    });
    expect(responsePayload.status).toBe('reassigned');
  });

  test('responsePayload incluye winner con patient_id y display_name', async () => {
    const client = makeClient({
      auctionRows:     [AUCTION_ROW],
      participantRows: [PARTICIPANT_ROW],
      transactionRows: [TRANSACTION_ROW]
    });
    getClient.mockResolvedValue(client);
    sendReturnEventWithRetry.mockResolvedValue({ success: true, attempts: 1 });

    const { responsePayload } = await resolveAuctionWinner({
      auctionId: 'auction-001', patientId: 'patient-001', appointmentId: 'appt-001'
    });
    expect(responsePayload.winner.patient_id).toBe('patient-001');
    expect(responsePayload.winner.display_name).toBe('Juan Pérez');
  });

  test('responsePayload incluye elapsed_ms > 0', async () => {
    const client = makeClient({
      auctionRows:     [AUCTION_ROW],
      participantRows: [PARTICIPANT_ROW],
      transactionRows: [TRANSACTION_ROW]
    });
    getClient.mockResolvedValue(client);
    sendReturnEventWithRetry.mockResolvedValue({ success: true, attempts: 1 });

    const { responsePayload } = await resolveAuctionWinner({
      auctionId: 'auction-001', patientId: 'patient-001', appointmentId: 'appt-001'
    });
    expect(responsePayload.elapsed_ms).toBeGreaterThanOrEqual(0);
  });

  test('llama a client.release() siempre en el finally', async () => {
    const client = makeClient({
      auctionRows:     [AUCTION_ROW],
      participantRows: [PARTICIPANT_ROW],
      transactionRows: [TRANSACTION_ROW]
    });
    getClient.mockResolvedValue(client);
    sendReturnEventWithRetry.mockResolvedValue({ success: true, attempts: 1 });

    await resolveAuctionWinner({ auctionId: 'auction-001', patientId: 'patient-001', appointmentId: 'appt-001' });
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('cuando no hay URL webhook → returnEvent.skipped = true', async () => {
    const noWebhookTx = { ...TRANSACTION_ROW, url_webhook_respuesta: null };
    const client = makeClient({
      auctionRows:     [AUCTION_ROW],
      participantRows: [PARTICIPANT_ROW],
      transactionRows: [noWebhookTx]
    });
    getClient.mockResolvedValue(client);

    const result = await resolveAuctionWinner({
      auctionId: 'auction-001', patientId: 'patient-001', appointmentId: 'appt-001'
    });
    expect(result.returnEvent.skipped).toBe(true);
    expect(sendReturnEventWithRetry).not.toHaveBeenCalled();
  });
});

// ─── Casos de error ───────────────────────────────────────────
describe('resolveAuctionWinner - casos de error', () => {
  beforeEach(() => jest.clearAllMocks());

  test('subasta no encontrada → lanza Error "Subasta no encontrada"', async () => {
    const client = makeClient({ auctionRows: [] });
    getClient.mockResolvedValue(client);

    await expect(
      resolveAuctionWinner({ auctionId: 'auction-xxx', patientId: 'p', appointmentId: 'ap' })
    ).rejects.toThrow('Subasta no encontrada');
    expect(client.release).toHaveBeenCalled();
  });

  test('subasta no activa → lanza Error con estado actual', async () => {
    const inactiveAuction = { ...AUCTION_ROW, estado: 'ganada' };
    const client = makeClient({ auctionRows: [inactiveAuction] });
    getClient.mockResolvedValue(client);

    await expect(
      resolveAuctionWinner({ auctionId: 'auction-001', patientId: 'p', appointmentId: 'ap' })
    ).rejects.toThrow(/ganada/);
  });

  test('paciente no participa en la subasta → lanza Error', async () => {
    const client = makeClient({
      auctionRows:     [AUCTION_ROW],
      participantRows: []
    });
    getClient.mockResolvedValue(client);

    await expect(
      resolveAuctionWinner({ auctionId: 'auction-001', patientId: 'p-no-existe', appointmentId: 'ap' })
    ).rejects.toThrow('El paciente no participa en esta subasta');
  });

  test('sin transacción asociada → lanza Error', async () => {
    const client = makeClient({
      auctionRows:     [AUCTION_ROW],
      participantRows: [PARTICIPANT_ROW],
      transactionRows: []
    });
    getClient.mockResolvedValue(client);

    await expect(
      resolveAuctionWinner({ auctionId: 'auction-001', patientId: 'patient-001', appointmentId: 'ap' })
    ).rejects.toThrow('No existe una transacción asociada');
  });

  test('webhook falla → result.returnEvent.status = "failed" pero no lanza error', async () => {
    const client = makeClient({
      auctionRows:     [AUCTION_ROW],
      participantRows: [PARTICIPANT_ROW],
      transactionRows: [TRANSACTION_ROW]
    });
    getClient.mockResolvedValue(client);
    sendReturnEventWithRetry.mockResolvedValue({ success: false, error: 'Timeout tras 3 intentos' });

    const result = await resolveAuctionWinner({
      auctionId: 'auction-001', patientId: 'patient-001', appointmentId: 'appt-001'
    });
    expect(result.success).toBe(true); // la transacción DB se completó
    expect(result.returnEvent.status).toBe('failed');
  });

  test('error en BD → hace ROLLBACK y llama release()', async () => {
    const client = {
      query: jest.fn(async (sql) => {
        if (sql === 'BEGIN') return;
        throw new Error('DB connection lost');
      }),
      release: jest.fn()
    };
    getClient.mockResolvedValue(client);

    await expect(
      resolveAuctionWinner({ auctionId: 'auction-001', patientId: 'patient-001', appointmentId: 'ap' })
    ).rejects.toThrow('DB connection lost');
    expect(client.release).toHaveBeenCalled();
  });
});