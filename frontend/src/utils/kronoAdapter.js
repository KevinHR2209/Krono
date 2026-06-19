

export function transformarDatosClinicaAKrono(datosClinica) {
    const fechaObjeto = new Date(datosClinica.fecha_hora_bloque);
    const fecha = fechaObjeto.toISOString().split('T')[0];

    const horas = String(fechaObjeto.getHours()).padStart(2, '0');
    const minutos = String(fechaObjeto.getMinutes()).padStart(2, '0');
    const horaInicio = `${horas}:${minutos}`;

    fechaObjeto.setMinutes(fechaObjeto.getMinutes() + 30);
    const horasFin = String(fechaObjeto.getHours()).padStart(2, '0');
    const minutosFin = String(fechaObjeto.getMinutes()).padStart(2, '0');
    const horaFin = `${horasFin}:${minutosFin}`;

    const listaEsperaKrono = datosClinica.pacientes_espera.map(paciente => ({
        patient_id: paciente.rut,
        display_name: paciente.nombre,
        phone: paciente.telefono,
        attendance_history: paciente.porcentaje_asistencia / 100,
        waiting_days: paciente.dias_en_espera,
        urgency_level: paciente.nivel_gravedad
    }));

    return {
        event_type: 'appointment_cancelled',
        source_system_id: 'CLINICA-PROVIDENCIA-01',
        cancellation: {
            appointment_id: datosClinica.id_reserva,
            cancelled_at: new Date().toISOString(),
            slot: {
                date: fecha,
                start_time: horaInicio,
                end_time: horaFin,
                doctor_name: datosClinica.nombre_medico,
                specialty: datosClinica.area_medica,
                location: datosClinica.sucursal
            },
            cancelled_patient: {
                patient_id: datosClinica.rut_paciente_cancela,
                display_name: datosClinica.nombre_paciente_cancela
            }
        },
        waitlist: listaEsperaKrono
    };
}