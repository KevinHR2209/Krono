  
const axios = require('axios');

const CORE_WEBHOOK_URL = 'http://localhost:3001/api/v1/webhook/cancellation';
const API_KEY = 'super-secret-api-key';

function buildPayload(appointmentId) {
  return {
    event_type: 'appointment_cancelled',
    source_system_id: 'demo-system',
    cancellation: {
      appointment_id: appointmentId,
      cancelled_at: new Date().toISOString(),
      slot: {
        date: '2026-05-20',
        start_time: '09:00',
        end_time: '09:30',
        doctor_name: 'Dra. Pérez',
        specialty: 'Cardiología',
        location: 'Sucursal Centro'
      },
      cancelled_patient: {
        patient_id: 'p-001',
        display_name: 'Juan Pérez'
      }
    },
    waitlist: [
      {
        patient_id: 'p-002',
        display_name: 'Ana Soto',
        phone: '+56911111111',
        attendance_history: 0.95,
        waiting_days: 12,
        urgency_level: 4,
        historial_asistencia_normalizado: 0.95,
        dias_espera_normalizado: 0.12,
        nivel_urgencia_normalizado: 0.4,
        puntaje_prioridad: 92,
        posicion_ranking: 3
      },
      {
        patient_id: 'p-003',
        display_name: 'Luis Pérez',
        phone: '+56922222222',
        attendance_history: 0.80,
        waiting_days: 20,
        urgency_level: 3,
        historial_asistencia_normalizado: 0.80,
        dias_espera_normalizado: 0.20,
        nivel_urgencia_normalizado: 0.3,
        puntaje_prioridad: 95,
        posicion_ranking: 1
      },
      {
        patient_id: 'p-004',
        display_name: 'María Soto',
        phone: '+56933333333',
        attendance_history: 0.70,
        waiting_days: 15,
        urgency_level: 4,
        historial_asistencia_normalizado: 0.70,
        dias_espera_normalizado: 0.15,
        nivel_urgencia_normalizado: 0.4,
        puntaje_prioridad: 93,
        posicion_ranking: 2
      }
    ]
  };
}

async function main() {
  const appointmentId = process.argv[2] || `apt-${Date.now()}`;
  const payload = buildPayload(appointmentId);

  try {
    const response = await axios.post(CORE_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      timeout: 15000
    });

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

main();