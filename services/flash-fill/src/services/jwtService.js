const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY_SECONDS = Number(process.env.JWT_EXPIRY_SECONDS || 120);

if (!JWT_SECRET) {
  throw new Error('Falta la variable de entorno JWT_SECRET');
}

function generateConfirmationToken(payload) {
  return jwt.sign(
    {
      auction_id: payload.auction_id,
      patient_id: payload.patient_id,
      appointment_id: payload.appointment_id
    },
    JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: JWT_EXPIRY_SECONDS
    }
  );
}

function verifyConfirmationToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256']
  });
}

module.exports = {
  generateConfirmationToken,
  verifyConfirmationToken
};