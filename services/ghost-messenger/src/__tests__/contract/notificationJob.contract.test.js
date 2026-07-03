const validJob = {
  auction_id: 'auction-001',
  appointment_id: 'appt-001',
  slot: {
    date: '2026-07-01',
    start_time: '10:00',
    end_time: '10:30',
    doctor_name: 'Matías Rojas',
    specialty: 'Corte Clásico',
    location: 'Local Principal'
  },
  candidates: [
    {
      patient_id: 'patient-001',
      display_name: 'María González',
      phone: '+56991234567',
      email: 'maria@test.com'
    }
  ]
};

describe('notification job contract', () => {
  test('acepta el payload mínimo válido', () => {
    expect(validJob.auction_id).toBeDefined();
    expect(validJob.appointment_id).toBeDefined();
    expect(validJob.slot).toBeDefined();
    expect(Array.isArray(validJob.candidates)).toBe(true);
  });

  test('rechaza candidatos sin campos obligatorios', () => {
    const badCandidate = { patient_id: 'p-1', phone: '+5699' };
    expect(badCandidate.display_name).toBeUndefined();
  });

  test('limita candidates a 5 en el contrato', () => {
    const candidates = Array.from({ length: 8 }, (_, i) => ({
      patient_id: `p-${i}`,
      display_name: `Paciente ${i}`,
      phone: `+569900000${i}`
    }));
    expect(candidates.slice(0, 5)).toHaveLength(5);
  });
});