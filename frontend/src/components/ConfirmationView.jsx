import { useState, useEffect } from 'react';

export default function ConfirmationView() {
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [token, setToken] = useState('');
  const [appointmentData, setAppointmentData] = useState(null);

  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
          window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Error decodificando el token:', e);
      return null;
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');

    if (tokenParam) {
      const cleanToken = tokenParam.replace(/^\/?api\/v1\/confirm\//, '');
      setToken(cleanToken);

      const decodedData = parseJwt(cleanToken);
      if (decodedData) {
        setAppointmentData(decodedData);
      }
    }
  }, []);

  const confirmarCupo = async () => {
    if (!token) return;
    setStatus('loading');

    try {
      const response = await fetch(`http://localhost:3001/api/v1/confirm/${token}`, {
        method: 'GET',
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'El cupo ya no está disponible.');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Error de conexión con el servidor.');
    }
  };

  // Pantalla de Éxito (Modificada a diseño claro)
  if (status === 'success') {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-3">¡Cupo Confirmado!</h2>
          <p className="text-slate-500 mb-8 max-w-sm text-lg">Tu asistencia ha sido registrada exitosamente. Te esperamos en tu cita.</p>
        </div>
    );
  }

  // Pantalla Principal (Modificada a diseño claro)
  return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl overflow-hidden">

          {/* Cabecera */}
          <div className="p-8 border-b border-slate-100 bg-white text-center">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Recuperación de Cupo</h2>
            <p className="text-sm text-emerald-600 mt-2 font-medium bg-emerald-50 inline-block px-3 py-1 rounded-full border border-emerald-100">
              Prioridad asignada por Smart-Queue
            </p>
          </div>

          {/* Detalles de la cita */}
          <div className="p-8 space-y-6">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Servicio / Barbero</span>
              <span className="text-lg text-slate-800 font-medium">
              {appointmentData?.specialty || 'Servicio'} - {appointmentData?.doctor_name || 'Barbero'}
            </span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Fecha y Hora</span>
              <span className="text-lg text-slate-800 font-medium">
              {appointmentData?.date ? new Date(appointmentData.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Fecha pendiente'} • <span className="text-emerald-600 font-bold">{appointmentData?.start_time || '00:00'}</span>
            </span>
            </div>

            <div className="flex flex-col mb-4">
              <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Ubicación</span>
              <span className="text-lg text-slate-800 font-medium">
              {appointmentData?.location || 'Local Principal'}
            </span>
            </div>

            {/* Mensajes de Error */}
            {status === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm font-medium mt-4 flex items-start gap-2">
                  <span className="text-lg leading-none">⚠</span> {errorMessage}
                </div>
            )}

            {/* Botón de Acción */}
            <button
                onClick={confirmarCupo}
                disabled={status === 'loading' || !token}
                className="w-full mt-6 bg-slate-800 text-white py-4 px-4 rounded-xl hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 transition-all duration-300 font-semibold tracking-wide text-lg flex justify-center items-center shadow-md disabled:shadow-none"
            >
              {status === 'loading' ? (
                  <span className="animate-pulse">Procesando confirmación...</span>
              ) : (
                  "Confirmar Asistencia"
              )}
            </button>

            <p className="text-center text-xs text-slate-500 mt-5 leading-relaxed">
              Al confirmar, asumes el compromiso de asistir a la hora indicada para no perjudicar al resto de la lista de espera.
            </p>
          </div>
        </div>
      </div>
  );
}