process.env.JWT_SECRET = 'test-secret-krono-2026';
process.env.JWT_EXPIRY_SECONDS = '120';

const jwt = require('jsonwebtoken');
const { generateJwt } = require('../../services/jwtService');

describe('generateJwt', () => {
  test('firma un JWT con los datos esperados', () => {
    const token = generateJwt('auction-001', 'patient-001', 'appt-001', { date: '2026-07-01' });
    const decoded = jwt.decode(token);
    expect(decoded.auction_id).toBe('auction-001');
    expect(decoded.patient_id).toBe('patient-001');
    expect(decoded.appointment_id).toBe('appt-001');
  });

  test('expira en el tiempo configurado', () => {
    const token = generateJwt('auction-001', 'patient-001', 'appt-001', {});
    const decoded = jwt.decode(token);
    expect(decoded.exp - decoded.iat).toBe(120);
  });
});