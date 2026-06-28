function buildConfirmLinkWithTokens(patientId, auctionId, appointmentId) {
  const jwtService = require('./jwtService');
  const token = jwtService.generateJwt(auctionId, patientId, appointmentId);
  const baseUrl = process.env.FLASH_FILL_BASE_URL || 'http://localhost:3001';
  return `${baseUrl}/api/v1/confirm/${token}`;
}

function buildMessage(candidate, slot, token) {
  const { display_name } = candidate;
  
  const message = `
CUPO DISPONIBLE - Barberia Krono

Hola *${display_name}*, tienes un cupo disponible!

Fecha: ${slot.date}
Hora: ${slot.start_time} - ${slot.end_time}
Peluquero: ${slot.doctor_name}
Corte: ${slot.specialty}
Lugar: ${slot.location}

¡Responde rápido! Este cupo es para el primero que confirme.

Haz clic aquí para confirmar:
${token}

Enlace expira en 2 minutos
`.trim();
  
  return message;
}

module.exports = {
  buildMessage,
  buildConfirmLinkWithTokens
};