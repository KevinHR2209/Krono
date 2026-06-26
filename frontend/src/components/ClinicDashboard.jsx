
import { useState } from 'react';
import { transformarDatosClinicaAKrono } from '../utils/kronoAdapter';

const citasDelDia = [
    {
        id_reserva: "RES-1003",
        fecha_hora_bloque: "2026-05-20T09:00:00",
        rut_medico: "12.345.678-9",
        nombre_medico: "Dra. Valentina Riquelme",
        area_medica: "Cardiología",
        sucursal: "Centro Médico Providencia",
        rut_paciente_cancela: "19.876.543-2",
        nombre_paciente_cancela: "Juan Pérez",
        pacientes_espera: [
            { rut: "15.111.222-3", nombre: "Ana Soto", telefono: "+56911111111", email: "christianperezvera0@gmail.com", porcentaje_asistencia: 95, dias_en_espera: 12, nivel_gravedad: 4 },
            { rut: "16.222.333-4", nombre: "Luis Silva", telefono: "+56922222222", email: "barberiakrono@gmail.com", porcentaje_asistencia: 80, dias_en_espera: 20, nivel_gravedad: 3 }
        ]
    },
    {
        id_reserva: "RES-0003",
        fecha_hora_bloque: "2026-05-20T11:30:00",
        rut_medico: "10.987.654-3",
        nombre_medico: "Dr. Roberto Neira",
        area_medica: "Neurología",
        sucursal: "Centro Médico Providencia",
        rut_paciente_cancela: "18.555.444-1",
        nombre_paciente_cancela: "María González",
        pacientes_espera: [
            { rut: "17.444.555-6", nombre: "Carlos Pinto", telefono: "+56933333333", email: "Khrvae@gmail.com", porcentaje_asistencia: 100, dias_en_espera: 5, nivel_gravedad: 2 },
            { rut: "14.333.222-1", nombre: "Sofía Castro", telefono: "+56944444444", email: "diegojavier.lf@gmail.com", porcentaje_asistencia: 60, dias_en_espera: 30, nivel_gravedad: 4 }
        ]
    }
];

export default function ClinicDashboard() {
    const [loadingId, setLoadingId] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null);

    const handleCancelar = async (citaLegacy) => {
        setLoadingId(citaLegacy.id_reserva);
        setStatusMsg(null);

        const payloadParaKrono = transformarDatosClinicaAKrono(citaLegacy);

        try {
            const res = await fetch('http://localhost:3000/api/v1/webhook/cancellation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'super-secret-api-key'
                },
                body: JSON.stringify(payloadParaKrono)
            });

            if (res.ok) {
                setStatusMsg({ type: 'success', text: `Cancelación procesada. Krono está reasignando el cupo de las ${payloadParaKrono.cancellation.slot.start_time}...` });
            } else {
                setStatusMsg({ type: 'error', text: 'Error al contactar con el integrador Krono.' });
            }
        } catch (error) {
            setStatusMsg({ type: 'error', text: 'Fallo de conexión. ¿El microservicio Core está levantado?' });
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-lg shadow-sm p-6">
                <header className="mb-8 border-b border-slate-100 pb-4 flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">MediSys ERP</h1>
                        <p className="text-sm text-slate-500">Módulo de Recepción - Centro Médico Providencia</p>
                    </div>
                    <div className="text-right text-sm text-slate-400">Usuario: Recepción 01</div>
                </header>

                {statusMsg && (
                    <div className={`mb-6 p-4 rounded-md text-sm ${statusMsg.type === 'success' ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                        {statusMsg.text}
                    </div>
                )}

                <h2 className="text-lg font-semibold text-slate-700 mb-4">Agenda del Día: 20 de Mayo, 2026</h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-slate-100 text-slate-600 text-sm border-y border-slate-200">
                            <th className="py-3 px-4 font-medium">Hora</th>
                            <th className="py-3 px-4 font-medium">Paciente</th>
                            <th className="py-3 px-4 font-medium">Especialista</th>
                            <th className="py-3 px-4 font-medium text-right">Acciones</th>
                        </tr>
                        </thead>
                        <tbody>
                        {citasDelDia.map((cita) => {
                            const hora = new Date(cita.fecha_hora_bloque).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                            const isLoading = loadingId === cita.id_reserva;

                            return (
                                <tr key={cita.id_reserva} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-4 font-semibold text-slate-700">{hora}</td>
                                    <td className="py-4 px-4">
                                        <div className="text-slate-800">{cita.nombre_paciente_cancela}</div>
                                        <div className="text-xs text-slate-400">RUT: {cita.rut_paciente_cancela}</div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="text-slate-800">{cita.nombre_medico}</div>
                                        <div className="text-xs text-slate-400">{cita.area_medica}</div>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        <button
                                            onClick={() => handleCancelar(cita)}
                                            disabled={isLoading}
                                            className={`px-4 py-2 text-sm rounded transition-colors ${
                                                isLoading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600 shadow-sm'
                                            }`}
                                        >
                                            {isLoading ? 'Procesando...' : 'Cancelar Cita'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}