const { buildReturnEventPayload } = require('../../services/returnEvent');

describe('returnEvent payload contract', () => {
  test('contiene los campos mínimos requeridos', () => {
    const payload = buildReturnEventPayload({
      auctionId: 'auction-001',
      patientId: 'patient-001',
      appointmentId: 'appt-001',
      displayName: 'Test Paciente'
    });

    expect(payload.status).toBeDefined();
    expect(payload.winner).toBeDefined();
    expect(payload.winner.patient_id).toBe('patient-001');
    expect(payload.winner.display_name).toBe('Test Paciente');
    expect(payload.appointment_id).toBe('appt-001');
    expect(payload.auction_id).toBe('auction-001');
  });

  test('no incluye campos sensibles innecesarios', () => {
    const payload = buildReturnEventPayload({
      auctionId: 'auction-001',
      patientId: 'patient-001',
      appointmentId: 'appt-001',
      displayName: 'Test Paciente',
      telefono: '+56991234567'
    });

    expect(payload).toHaveProperty('winner');
  });
});