BEGIN;

-- 1. SISTEMAS ORIGEN (LOS "TENANTS" O CLIENTES DEL SAAS)
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
          'BARBERIA-KRONO-01',
          'Barbería Krono',
          'estetica',
          'dev-hash-barberia-krono',
          'contacto@barberiakrono.cl',
          'http://host.docker.internal:8000/api/citas/krono-resultado',
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
      ),
      (
          '33333333-3333-3333-3333-333333333333',
          'RESTAURANT-VALPO-01',
          'Cafetería de Especialidad Valparaíso',
          'gastronomia',
          'dev-hash-cafe-valpo',
          'reservas@cafeespecialidad.cl',
          'https://cliente-demo.cl/api/krono/result-restaurant',
          TRUE
      )
    ON CONFLICT (identificador_sistema_origen) DO NOTHING;

-- 2. CONFIGURACIÓN DE PESOS DINÁMICA (JSONB)
INSERT INTO configuracion_pesos (
    id,
    sistema_origen_id,
    pesos,
    activo,
    creado_por
) VALUES
      (
          '44444444-4444-4444-4444-444444444441',
          '11111111-1111-1111-1111-111111111111',
          '{"asistencia": 0.60, "distancia": 0.40}'::jsonb,
          TRUE,
          'seed'
      ),
      (
          '44444444-4444-4444-4444-444444444442',
          '22222222-2222-2222-2222-222222222222',
          '{"fiabilidad": 0.50, "nivel_jugador": 0.30, "distancia": 0.20}'::jsonb,
          TRUE,
          'seed'
      ),
      (
          '44444444-4444-4444-4444-444444444443',
          '33333333-3333-3333-3333-333333333333',
          '{"tamaño_grupo": 0.50, "fidelidad": 0.30, "distancia": 0.20}'::jsonb,
          TRUE,
          'seed'
      )
    ON CONFLICT DO NOTHING;

-- 3. CITAS DE PRUEBA CANCELADAS
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
          '55555555-5555-5555-5555-555555555551',
          '11111111-1111-1111-1111-111111111111',
          'APT-2026-000847',
          NOW() - INTERVAL '5 minutes',
          CURRENT_DATE + INTERVAL '1 day',
          '10:00',
          '10:30',
          'Matías González',
          'Corte + Barba',
          'Silla 1',
          'PAT-0091',
          'Carlos Mendoza',
          'cancelada'
      ),
      (
          '55555555-5555-5555-5555-555555555552',
          '33333333-3333-3333-3333-333333333333',
          'RES-2026-000112',
          NOW() - INTERVAL '15 minutes',
          CURRENT_DATE + INTERVAL '2 days',
          '17:00',
          '18:00',
          'Barista Principal',
          'Cata de V60 y Prensa Francesa',
          'Mesa 4 - Terraza',
          'CLI-0042',
          'Sofía Castro',
          'cancelada'
      )
    ON CONFLICT (sistema_origen_id, identificador_cita_externa) DO NOTHING;

-- 4. CANDIDATOS EN LISTA DE ESPERA
INSERT INTO candidatos_lista_espera (
    id,
    cita_id,
    identificador_paciente,
    nombre_visible,
    telefono,
    historial_asistencia
) VALUES
      (
          '60000000-0000-0000-0000-000000000001',
          '55555555-5555-5555-5555-555555555551',
          'PAT-0204',
          'Ana Flores',
          '+56912345678',
          0.950
      ),
      (
          '60000000-0000-0000-0000-000000000002',
          '55555555-5555-5555-5555-555555555551',
          'PAT-0311',
          'Jorge Ramírez',
          '+56912345679',
          0.870
      ),
      (
          '60000000-0000-0000-0000-000000000003',
          '55555555-5555-5555-5555-555555555551',
          'PAT-0148',
          'Camila Soto',
          '+56912345680',
          0.990
      ),
      (
          '60000000-0000-0000-0000-000000000004',
          '55555555-5555-5555-5555-555555555551',
          'PAT-0187',
          'Matías Pérez',
          '+56912345681',
          0.760
      ),
      (
          '60000000-0000-0000-0000-000000000005',
          '55555555-5555-5555-5555-555555555551',
          'PAT-0222',
          'Fernanda Muñoz',
          '+56912345682',
          0.920
      )
    ON CONFLICT (cita_id, identificador_paciente) DO NOTHING;

COMMIT;