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
    <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-2xl shadow-2xl mt-8">
      <div className="flex flex-col items-start mb-8">
        <h2 className="text-2xl font-light tracking-wide text-zinc-100">Simulador de Eventos</h2>
        <p className="text-xs text-zinc-500 mt-2 font-mono bg-zinc-900 px-3 py-1 rounded-md border border-zinc-800">
          &gt; webhook_listener: active
        </p>
      </div>

      <button
        onClick={dispararWebhook}
        disabled={loading}
        className="w-full bg-zinc-100 text-zinc-950 py-3 px-4 rounded-lg hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-600 transition-all font-semibold tracking-wide"
      >
        {loading ? "Transmitiendo..." : "Ejecutar Cancelación"}
      </button>

      {response && (
        <div className={`mt-8 p-5 rounded-xl border text-sm font-mono ${
          response.status === 200 || response.status === 202 
            ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400' 
            : 'bg-rose-950/20 border-rose-900/50 text-rose-400'
        }`}>
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-2 h-2 rounded-full ${response.status === 200 || response.status === 202 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            <h3 className="font-semibold">STATUS: {response.status}</h3>
          </div>
          <pre className="whitespace-pre-wrap">{JSON.stringify(response.data || response.error, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}