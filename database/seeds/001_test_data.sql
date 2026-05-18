BEGIN;

INSERT INTO source_systems (
    id,
    source_system_id,
    name,
    domain,
    api_key_hash,
    contact_email,
    webhook_callback_url,
    is_active
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
ON CONFLICT (source_system_id) DO NOTHING;

INSERT INTO weight_config (
    id,
    w1_attendance,
    w2_waiting_time,
    w3_urgency,
    is_active,
    effective_from,
    created_by
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

INSERT INTO appointments (
    id,
    source_system_id,
    external_appointment_id,
    cancelled_at,
    slot_date,
    start_time,
    end_time,
    doctor_name,
    specialty,
    location,
    cancelled_patient_id,
    cancelled_patient_name,
    status
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
    'cancelled'
)
ON CONFLICT (source_system_id, external_appointment_id) DO NOTHING;

INSERT INTO waitlist_candidates (
    id,
    appointment_id,
    patient_id,
    display_name,
    phone,
    attendance_history,
    waiting_days,
    urgency_level
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
ON CONFLICT (appointment_id, patient_id) DO NOTHING;

COMMIT;