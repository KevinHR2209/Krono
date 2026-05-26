const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'krono_ghost_messenger_secret_key_2026';
const JWT_EXPIRY_SECONDS = parseInt(process.env.JWT_EXPIRY_SECONDS, 10) || 120;

function generateJwt(auctionId, patientId, appointmentId) {
  const payload = {
    auction_id: auctionId,
    patient_id: patientId,
    appointment_id: appointmentId
  };

  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRY_SECONDS
  });
}

function verifyJwt(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    });
    return { valid: true, payload: decoded };
  } catch (error) {
    return {
      valid: false,
      error: error.name === 'TokenExpiredError' ? 'expired' : 'invalid'
    };
  }
}

module.exports = {
  generateJwt,
  verifyJwt
};