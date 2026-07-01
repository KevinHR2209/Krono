import { useState, useEffect } from 'react';

export default function ConfirmationView() {
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [token, setToken] = useState('');
  const [appointmentData, setAppointmentData] = useState(null);

  // Función para decodificar el payload del JWT sin usar librerías externas
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
      // 1. Limpiamos el token por si trae basura de la URL
      const cleanToken = tokenParam.replace(/^\/?api\/v1\/confirm\//, '');
      setToken(cleanToken);

      // 2. Extraemos los datos para mostrarlos en pantalla
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

  if (status === 'success') {
    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 className="text-3xl font-light text-zinc-100 mb-2">¡Cupo Confirmado!</h2>
          <p className="text-zinc-400 mb-8 max-w-sm">Tu asistencia ha sido registrada exitosamente. Te esperamos en la barbería.</p>
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
        <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">

          <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
            <h2 className="text-2xl font-light text-zinc-100 tracking-wide">Recuperación de Cupo</h2>
            <p className="text-sm text-emerald-400 mt-1 font-medium">Prioridad asignada por Smart-Queue</p>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Servicio / Barbero</span>
              <span className="text-lg text-zinc-200">
              {appointmentData?.specialty || 'Servicio'} - {appointmentData?.doctor_name || 'Barbero'}
            </span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Fecha y Hora</span>
              <span className="text-lg text-zinc-200">
              {appointmentData?.date ? new Date(appointmentData.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Fecha pendiente'} • {appointmentData?.start_time || '00:00'}
            </span>
            </div>

            <div className="flex flex-col mb-4">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Ubicación</span>
              <span className="text-lg text-zinc-200">
              {appointmentData?.location || 'Local Principal'}
            </span>
            </div>

            {status === 'error' && (
                <div className="bg-rose-950/30 border border-rose-900/50 text-rose-400 p-4 rounded-lg text-sm font-mono mt-4">
                  ⚠ {errorMessage}
                </div>
            )}

            <button
                onClick={confirmarCupo}
                disabled={status === 'loading' || !token}
                className="w-full mt-6 bg-zinc-100 text-zinc-950 py-4 px-4 rounded-xl hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-600 transition-all duration-300 font-bold tracking-wide text-lg flex justify-center items-center shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            >
              {status === 'loading' ? (
                  <span className="animate-pulse">Procesando...</span>
              ) : (
                  "Confirmar Asistencia"
              )}
            </button>

            <p className="text-center text-xs text-zinc-600 mt-4">
              Al confirmar, asumes el compromiso de asistir a la hora indicada.
            </p>
          </div>
        </div>
      </div>
  );
}