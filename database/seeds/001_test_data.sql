BEGIN;

INSERT INTO sistemas_origen (
    id,
    identificador_sistema_origen,
    nombre,
    dominio,
    hash_api_key,
    correo_contacto,
    url_webhook_respuesta,
    activo
) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'CLINICA-PROVIDENCIA-01',
    'Clínica Providencia',
    'medico',
    'dev-hash-clinica-providencia',
    'integraciones@clinicprovidencia.cl',
    'https://cliente-demo.cl/api/krono/result',
    TRUE
),
(
    '22222222-2222-2222-2222-222222222222',
    'SPORTCENTER-VINA-01',
    'SportCenter Viña',
    'deportivo',
    'dev-hash-sportcenter-vina',
    'soporte@sportcenter.cl',
    'https://cliente-demo.cl/api/krono/result-sport',
    TRUE
)
ON CONFLICT (identificador_sistema_origen) DO NOTHING;

INSERT INTO configuracion_pesos (
    id,
    peso_historial_asistencia,
    peso_tiempo_espera,
    peso_urgencia,
    activo,
    vigente_desde,
    creado_por
) VALUES
(
    '33333333-3333-3333-3333-333333333333',
    0.400,
    0.350,
    0.250,
    TRUE,
    NOW(),
    'seed'
)
ON CONFLICT DO NOTHING;

INSERT INTO citas (
    id,
    sistema_origen_id,
    identificador_cita_externa,
    cancelada_en,
    fecha_bloque,
    hora_inicio,
    hora_fin,
    nombre_doctor,
    especialidad,
    ubicacion,
    identificador_paciente_cancelado,
    nombre_paciente_cancelado,
    estado
) VALUES
(
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'APT-2026-000847',
    NOW() - INTERVAL '5 minutes',
    CURRENT_DATE + INTERVAL '1 day',
    '10:00',
    '10:30',
    'Dra. Valentina Riquelme',
    'Cardiología',
    'Sala 3 - Piso 2',
    'PAT-0091',
    'Carlos Mendoza',
    'cancelada'
)
ON CONFLICT (sistema_origen_id, identificador_cita_externa) DO NOTHING;

INSERT INTO candidatos_lista_espera (
    id,
    cita_id,
    identificador_paciente,
    nombre_visible,
    telefono,
    historial_asistencia,
    dias_espera,
    nivel_urgencia
) VALUES
(
    '50000000-0000-0000-0000-000000000001',
    '44444444-4444-4444-4444-444444444444',
    'PAT-0204',
    'Ana Flores',
    '+56912345678',
    0.950,
    14,
    3
),
(
    '50000000-0000-0000-0000-000000000002',
    '44444444-4444-4444-4444-444444444444',
    'PAT-0311',
    'Jorge Ramírez',
    '+56912345679',
    0.870,
    30,
    4
),
(
    '50000000-0000-0000-0000-000000000003',
    '44444444-4444-4444-4444-444444444444',
    'PAT-0148',
    'Camila Soto',
    '+56912345680',
    0.990,
    7,
    2
),
(
    '50000000-0000-0000-0000-000000000004',
    '44444444-4444-4444-4444-444444444444',
    'PAT-0187',
    'Matías Pérez',
    '+56912345681',
    0.760,
    45,
    4
),
(
    '50000000-0000-0000-0000-000000000005',
    '44444444-4444-4444-4444-444444444444',
    'PAT-0222',
    'Fernanda Muñoz',
    '+56912345682',
    0.920,
    21,
    1
),
(
    '50000000-0000-0000-0000-000000000006',
    '44444444-4444-4444-4444-444444444444',
    'PAT-0275',
    'Sebastián Torres',
    '+56912345683',
    0.680,
    60,
    3
),
(
    '50000000-0000-0000-0000-000000000007',
    '44444444-4444-4444-4444-444444444444',
    'PAT-0299',
    'Daniela Contreras',
    '+56912345684',
    0.840,
    10,
    2
),
(
    '50000000-0000-0000-0000-000000000008',
    '44444444-4444-4444-4444-444444444444',
    'PAT-0333',
    'Rodrigo Castillo',
    '+56912345685',
    0.730,
    90,
    4
)
ON CONFLICT (cita_id, identificador_paciente) DO NOTHING;

COMMIT;