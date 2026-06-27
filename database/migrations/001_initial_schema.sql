BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_cita_enum') THEN
CREATE TYPE estado_cita_enum AS ENUM (
            'cancelada',
            'subasta_pendiente',
            'notificada',
            'reasignada',
            'expirada',
            'fallida'
        );
END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_subasta_enum') THEN
CREATE TYPE estado_subasta_enum AS ENUM (
            'pendiente',
            'activa',
            'ganada',
            'expirada',
            'fallida'
        );
END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_participante_enum') THEN
CREATE TYPE estado_participante_enum AS ENUM (
            'rankeado',
            'notificado',
            'entregado',
            'confirmado',
            'ganador',
            'perdedor',
            'expirado',
            'fallido'
        );
END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_transaccion_enum') THEN
CREATE TYPE estado_transaccion_enum AS ENUM (
            'reasignada',
            'expirada',
            'fallida'
        );
END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_cola_muerta_enum') THEN
CREATE TYPE estado_cola_muerta_enum AS ENUM (
            'pendiente',
            'reintentando',
            'descartado',
            'resuelto'
        );
END IF;
END $$;

CREATE TABLE IF NOT EXISTS sistemas_origen (
                                               id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identificador_sistema_origen VARCHAR(100) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    dominio VARCHAR(120),
    hash_api_key TEXT NOT NULL,
    correo_contacto VARCHAR(150),
    url_webhook_respuesta TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS citas (
                                     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sistema_origen_id UUID NOT NULL REFERENCES sistemas_origen(id) ON DELETE RESTRICT,
    identificador_cita_externa VARCHAR(100) NOT NULL,
    cancelada_en TIMESTAMPTZ NOT NULL,
    fecha_bloque DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    nombre_doctor VARCHAR(150) NOT NULL,
    especialidad VARCHAR(120) NOT NULL,
    ubicacion VARCHAR(180) NOT NULL,
    identificador_paciente_cancelado VARCHAR(100) NOT NULL,
    nombre_paciente_cancelado VARCHAR(150) NOT NULL,
    estado estado_cita_enum NOT NULL DEFAULT 'cancelada',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_citas_sistema_cita_externa UNIQUE (sistema_origen_id, identificador_cita_externa),
    CONSTRAINT chk_citas_rango_horario CHECK (hora_fin > hora_inicio)
    );

CREATE TABLE IF NOT EXISTS subastas (
                                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_id UUID NOT NULL UNIQUE REFERENCES citas(id) ON DELETE CASCADE,
    id_correlacion UUID NOT NULL UNIQUE,
    id_transaccion UUID NOT NULL UNIQUE,
    estado estado_subasta_enum NOT NULL DEFAULT 'pendiente',
    cantidad_top_candidatos INTEGER NOT NULL DEFAULT 5,
    cantidad_total_candidatos INTEGER NOT NULL,
    participante_ganador_id UUID NULL,
    identificador_paciente_ganador VARCHAR(100),
    nombre_visible_ganador VARCHAR(150),
    iniciada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_en TIMESTAMPTZ NOT NULL,
    resuelta_en TIMESTAMPTZ,
    tiempo_transcurrido_ms INTEGER,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_subastas_total_candidatos CHECK (cantidad_total_candidatos > 0),
    CONSTRAINT chk_subastas_top_candidatos CHECK (cantidad_top_candidatos BETWEEN 1 AND 5),
    CONSTRAINT chk_subastas_tiempo_transcurrido CHECK (tiempo_transcurrido_ms IS NULL OR tiempo_transcurrido_ms >= 0),
    CONSTRAINT chk_subastas_expiracion CHECK (expira_en > iniciada_en)
    );

CREATE TABLE IF NOT EXISTS candidatos_lista_espera (
                                                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_id UUID NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
    identificador_paciente VARCHAR(100) NOT NULL,
    nombre_visible VARCHAR(150) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    historial_asistencia NUMERIC(4,3) NOT NULL,
    latitud NUMERIC(10,7),
    longitud NUMERIC(10,7),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_candidatos_lista_espera_cita_paciente UNIQUE (cita_id, identificador_paciente),
    CONSTRAINT chk_candidatos_lista_espera_telefono CHECK (telefono ~ '^\+569[0-9]{8}$'),
    CONSTRAINT chk_candidatos_lista_espera_historial CHECK (historial_asistencia >= 0.0 AND historial_asistencia <= 1.0)
    );

CREATE TABLE IF NOT EXISTS participantes_subasta (
                                                     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subasta_id UUID NOT NULL REFERENCES subastas(id) ON DELETE CASCADE,
    candidato_lista_espera_id UUID NOT NULL REFERENCES candidatos_lista_espera(id) ON DELETE CASCADE,
    identificador_paciente VARCHAR(100) NOT NULL,
    nombre_visible VARCHAR(150) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    historial_asistencia NUMERIC(4,3) NOT NULL,
    latitud NUMERIC(10,7),
    longitud NUMERIC(10,7),
    distancia_km NUMERIC(8,2),
    historial_asistencia_normalizado NUMERIC(6,5) NOT NULL,
    distancia_normalizada NUMERIC(6,5) NOT NULL,
    puntaje_prioridad NUMERIC(8,5) NOT NULL,
    posicion_ranking INTEGER NOT NULL,
    jti_token_notificacion UUID,
    notificado_en TIMESTAMPTZ,
    respondido_en TIMESTAMPTZ,
    estado estado_participante_enum NOT NULL DEFAULT 'rankeado',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_participantes_subasta_candidato UNIQUE (subasta_id, candidato_lista_espera_id),
    CONSTRAINT uq_participantes_subasta_ranking UNIQUE (subasta_id, posicion_ranking),
    CONSTRAINT chk_participantes_subasta_telefono CHECK (telefono ~ '^\+569[0-9]{8}$'),
    CONSTRAINT chk_participantes_subasta_historial CHECK (historial_asistencia >= 0.0 AND historial_asistencia <= 1.0),
    CONSTRAINT chk_participantes_subasta_posicion CHECK (posicion_ranking > 0),
    CONSTRAINT chk_participantes_subasta_puntaje CHECK (puntaje_prioridad >= 0.0),
    CONSTRAINT chk_participantes_subasta_historial_normalizado CHECK (historial_asistencia_normalizado >= 0.0 AND historial_asistencia_normalizado <= 1.0),
    CONSTRAINT chk_participantes_subasta_distancia_normalizada CHECK (distancia_normalizada >= 0.0 AND distancia_normalizada <= 1.0)
    );

CREATE TABLE IF NOT EXISTS transacciones (
                                             id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_transaccion UUID NOT NULL UNIQUE,
    id_correlacion UUID NOT NULL UNIQUE,
    subasta_id UUID NOT NULL UNIQUE REFERENCES subastas(id) ON DELETE CASCADE,
    cita_id UUID NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
    sistema_origen_id UUID NOT NULL REFERENCES sistemas_origen(id) ON DELETE RESTRICT,
    estado estado_transaccion_enum NOT NULL,
    participante_ganador_id UUID NULL REFERENCES participantes_subasta(id) ON DELETE SET NULL,
    identificador_paciente_ganador VARCHAR(100),
    nombre_visible_ganador VARCHAR(150),
    payload_respuesta JSONB NOT NULL,
    intentos_retorno INTEGER NOT NULL DEFAULT 0,
    ultimo_intento_retorno_en TIMESTAMPTZ,
    reasignada_en TIMESTAMPTZ,
    tiempo_transcurrido_ms INTEGER NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_transacciones_tiempo CHECK (tiempo_transcurrido_ms >= 0),
    CONSTRAINT chk_transacciones_intentos CHECK (intentos_retorno >= 0)
    );

CREATE TABLE IF NOT EXISTS configuracion_pesos (
                                                   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    peso_historial_asistencia NUMERIC(4,3) NOT NULL,
    peso_distancia NUMERIC(4,3) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    vigente_desde TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_por VARCHAR(100) NOT NULL DEFAULT 'system',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_configuracion_pesos_historial CHECK (peso_historial_asistencia >= 0 AND peso_historial_asistencia <= 1),
    CONSTRAINT chk_configuracion_pesos_distancia CHECK (peso_distancia >= 0 AND peso_distancia <= 1),
    CONSTRAINT chk_configuracion_pesos_suma CHECK ((peso_historial_asistencia + peso_distancia) BETWEEN 0.999 AND 1.001)
    );

CREATE TABLE IF NOT EXISTS cola_letras_muertas (
                                                   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subasta_id UUID REFERENCES subastas(id) ON DELETE SET NULL,
    id_transaccion UUID,
    id_correlacion UUID,
    sistema_origen_id UUID REFERENCES sistemas_origen(id) ON DELETE SET NULL,
    tipo_evento VARCHAR(100) NOT NULL,
    url_destino TEXT,
    payload JSONB NOT NULL,
    mensaje_error TEXT NOT NULL,
    intentos INTEGER NOT NULL DEFAULT 3,
    estado estado_cola_muerta_enum NOT NULL DEFAULT 'pendiente',
    ultimo_intento_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resuelto_en TIMESTAMPTZ,
    CONSTRAINT chk_cola_letras_muertas_intentos CHECK (intentos >= 0)
    );

ALTER TABLE subastas
    ADD CONSTRAINT fk_subastas_participante_ganador
        FOREIGN KEY (participante_ganador_id)
            REFERENCES participantes_subasta(id)
            ON DELETE SET NULL
            DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_sistemas_origen_activo ON sistemas_origen (activo);
CREATE INDEX IF NOT EXISTS idx_citas_sistema_origen ON citas (sistema_origen_id);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON citas (estado);
CREATE INDEX IF NOT EXISTS idx_citas_fecha_bloque ON citas (fecha_bloque);
CREATE INDEX IF NOT EXISTS idx_subastas_estado ON subastas (estado);
CREATE INDEX IF NOT EXISTS idx_subastas_id_correlacion ON subastas (id_correlacion);
CREATE INDEX IF NOT EXISTS idx_subastas_id_transaccion ON subastas (id_transaccion);
CREATE INDEX IF NOT EXISTS idx_subastas_expira_en ON subastas (expira_en);
CREATE INDEX IF NOT EXISTS idx_candidatos_lista_espera_cita ON candidatos_lista_espera (cita_id);
CREATE INDEX IF NOT EXISTS idx_participantes_subasta_subasta ON participantes_subasta (subasta_id);
CREATE INDEX IF NOT EXISTS idx_participantes_subasta_estado ON participantes_subasta (estado);
CREATE INDEX IF NOT EXISTS idx_participantes_subasta_puntaje ON participantes_subasta (subasta_id, puntaje_prioridad DESC, posicion_ranking ASC);
CREATE INDEX IF NOT EXISTS idx_transacciones_estado ON transacciones (estado);
CREATE INDEX IF NOT EXISTS idx_transacciones_subasta ON transacciones (subasta_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_cita ON transacciones (cita_id);
CREATE INDEX IF NOT EXISTS idx_configuracion_pesos_activo ON configuracion_pesos (activo, vigente_desde DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_configuracion_pesos_unico_activo ON configuracion_pesos (activo) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_cola_letras_muertas_estado ON cola_letras_muertas (estado, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_cola_letras_muertas_id_correlacion ON cola_letras_muertas (id_correlacion);

CREATE OR REPLACE FUNCTION establecer_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sistemas_origen_actualizado_en ON sistemas_origen;
CREATE TRIGGER trg_sistemas_origen_actualizado_en BEFORE UPDATE ON sistemas_origen FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();

DROP TRIGGER IF EXISTS trg_citas_actualizado_en ON citas;
CREATE TRIGGER trg_citas_actualizado_en BEFORE UPDATE ON citas FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();

DROP TRIGGER IF EXISTS trg_subastas_actualizado_en ON subastas;
CREATE TRIGGER trg_subastas_actualizado_en BEFORE UPDATE ON subastas FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();

DROP TRIGGER IF EXISTS trg_participantes_subasta_actualizado_en ON participantes_subasta;
CREATE TRIGGER trg_participantes_subasta_actualizado_en BEFORE UPDATE ON participantes_subasta FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();

COMMIT;