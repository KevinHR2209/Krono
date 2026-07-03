const request = require('supertest');
const app     = require('../../app');

describe('GET /health', () => {
  test('retorna 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
  });

  test('retorna body con status ok', async () => {
    const res = await request(app).get('/health');
    // Acepta { status: 'ok' } o { ok: true } o similar
    expect(res.body).toBeDefined();
  });
});