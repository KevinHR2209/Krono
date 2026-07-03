const request = require('supertest');
const app     = require('../../app');

// Mock del worker — las pruebas de API no deben conectar a Redis
jest.mock('../../workers/notificationWorker', () => ({
  startWorker:         jest.fn().mockResolvedValue(undefined),
  enqueueNotification: jest.fn().mockResolvedValue({ id: 'job-mock-001' }),
  closeWorker:         jest.fn().mockResolvedValue(undefined)
}));

const BASE_BODY = {
  auction_id:     'auction-001',
  appointment_id: 'appt-001',
  slot: {
    date:        '2026-07-01',
    start_time:  '10:00',
    end_time:    '10:30',
    doctor_name: 'Matías Rojas',
    specialty:   'Corte Clásico',
    location:    'Local Principal'
  },
  candidates: [
    {
      patient_id:   'patient-001',
      display_name: 'María González',
      phone:        '+56991234567',
      email:        'maria@test.com'
    }
  ]
};

describe('POST /notifications', () => {
  test('responde 202 con payload válido', async () => {
    const res = await request(app).post('/notifications').send(BASE_BODY);
    expect(res.statusCode).toBe(202);
    expect(res.body.jobId).toBe('job-mock-001');
  });

  test('rechaza payload vacío con 400', async () => {
    const res = await request(app).post('/notifications').send({});
    expect(res.statusCode).toBe(400);
  });

  test('rechaza payload sin candidates con 400', async () => {
    const res = await request(app)
      .post('/notifications')
      .send({ ...BASE_BODY, candidates: [] });
    expect(res.statusCode).toBe(400);
  });

  test('rechaza payload sin slot con 400', async () => {
    const res = await request(app)
      .post('/notifications')
      .send({ ...BASE_BODY, slot: undefined });
    expect(res.statusCode).toBe(400);
  });

  test('rechaza payload sin auction_id con 400', async () => {
    const res = await request(app)
      .post('/notifications')
      .send({ ...BASE_BODY, auction_id: undefined });
    expect(res.statusCode).toBe(400);
  });
});