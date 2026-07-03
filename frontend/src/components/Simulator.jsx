import { useState } from 'react';

export default function Simulator() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);

  const dispararWebhook = async () => {
    setLoading(true);
    setResponse(null);

    const payloadCancelacion = {
      event_type: 'appointment_cancelled',
      source_system_id: 'demo-system',
      cancellation: {
        appointment_id: `apt-${Date.now()}`,
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
          urgency_level: 4
        },
        {
          patient_id: 'p-003',
          display_name: 'Luis Pérez',
          phone: '+56922222222',
          attendance_history: 0.80,
          waiting_days: 20,
          urgency_level: 3
        }
      ]
    };

    try {
      const res = await fetch('http://localhost:3000/api/v1/webhook/cancellation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'super-secret-api-key'
        },
        body: JSON.stringify(payloadCancelacion)
      });

      const data = await res.json();
      setResponse({ status: res.status, data });
    } catch (error) {
      setResponse({ status: 500, error: "Error de conexión con el microservicio Core." });
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm mt-8 font-sans">
        <div className="flex flex-col items-start mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Simulador de Eventos</h2>
          <p className="text-xs text-emerald-700 mt-2 font-mono bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
            &gt; webhook_listener: active
          </p>
        </div>

        <button
            onClick={dispararWebhook}
            disabled={loading}
            className="w-full bg-slate-800 text-white py-3 px-4 rounded-xl hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 transition-all font-semibold tracking-wide shadow-md disabled:shadow-none"
        >
          {loading ? "Transmitiendo..." : "Ejecutar Cancelación"}
        </button>

        {response && (
            <div className={`mt-8 p-5 rounded-xl border text-sm font-mono ${
                response.status === 200 || response.status === 202
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <span className={`w-2.5 h-2.5 rounded-full ${response.status === 200 || response.status === 202 ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                <h3 className="font-semibold">STATUS: {response.status}</h3>
              </div>
              <pre className="whitespace-pre-wrap">{JSON.stringify(response.data || response.error, null, 2)}</pre>
            </div>
        )}
      </div>
  );
}