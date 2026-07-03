const request = require('supertest');
const app     = require('../../app');

describe('flash-fill app routes', () => {
  test('GET /health responde 200 y status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('flash-fill');
  });

  test('ruta inexistente responde 404', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});