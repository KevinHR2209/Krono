BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status_enum') THEN
        CREATE TYPE appointment_status_enum AS ENUM (
            'cancelled',
            'auction_pending',
            'notified',
            'reassigned',
            'expired',
            'failed'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auction_status_enum') THEN
        CREATE TYPE auction_status_enum AS ENUM (
            'pending',
            'active',
            'won',
            'expired',
            'failed'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'participant_status_enum') THEN
        CREATE TYPE participant_status_enum AS ENUM (
            'ranked',
            'notified',
            'delivered',
            'confirmed',
            'won',
            'lost',
            'expired',
            'failed'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status_enum') THEN
        CREATE TYPE transaction_status_enum AS ENUM (
            'reassigned',
            'expired',
            'failed'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dead_letter_status_enum') THEN
        CREATE TYPE dead_letter_status_enum AS ENUM (
            'pending',
            'retrying',
            'discarded',
            'resolved'
        );
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS source_systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_system_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    domain VARCHAR(120),
    api_key_hash TEXT NOT NULL,
    contact_email VARCHAR(150),
    webhook_callback_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_system_id UUID NOT NULL REFERENCES source_systems(id) ON DELETE RESTRICT,
    external_appointment_id VARCHAR(100) NOT NULL,
    cancelled_at TIMESTAMPTZ NOT NULL,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    doctor_name VARCHAR(150) NOT NULL,
    specialty VARCHAR(120) NOT NULL,
    location VARCHAR(180) NOT NULL,
    cancelled_patient_id VARCHAR(100) NOT NULL,
    cancelled_patient_name VARCHAR(150) NOT NULL,
    status appointment_status_enum NOT NULL DEFAULT 'cancelled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_appointments_source_external UNIQUE (source_system_id, external_appointment_id),
    CONSTRAINT chk_appointments_time_range CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    correlation_id UUID NOT NULL UNIQUE,
    transaction_id UUID NOT NULL UNIQUE,
    status auction_status_enum NOT NULL DEFAULT 'pending',
    top_candidates_count INTEGER NOT NULL DEFAULT 5,
    total_candidates_count INTEGER NOT NULL,
    winner_participant_id UUID NULL,
    winner_patient_id VARCHAR(100),
    winner_display_name VARCHAR(150),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    elapsed_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_auctions_total_candidates CHECK (total_candidates_count > 0),
    CONSTRAINT chk_auctions_top_candidates CHECK (top_candidates_count BETWEEN 1 AND 5),
    CONSTRAINT chk_auctions_elapsed_ms CHECK (elapsed_ms IS NULL OR elapsed_ms >= 0),
    CONSTRAINT chk_auctions_expiry_after_start CHECK (expires_at > started_at)
);

CREATE TABLE IF NOT EXISTS waitlist_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id VARCHAR(100) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    attendance_history NUMERIC(4,3) NOT NULL,
    waiting_days INTEGER NOT NULL,
    urgency_level INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_waitlist_candidates_appointment_patient UNIQUE (appointment_id, patient_id),
    CONSTRAINT chk_waitlist_candidates_phone CHECK (phone ~ '^\+569[0-9]{8}$'),
    CONSTRAINT chk_waitlist_candidates_attendance CHECK (attendance_history >= 0.0 AND attendance_history <= 1.0),
    CONSTRAINT chk_waitlist_candidates_waiting_days CHECK (waiting_days >= 0),
    CONSTRAINT chk_waitlist_candidates_urgency CHECK (urgency_level BETWEEN 1 AND 4)
);

CREATE TABLE IF NOT EXISTS auction_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    waitlist_candidate_id UUID NOT NULL REFERENCES waitlist_candidates(id) ON DELETE CASCADE,
    patient_id VARCHAR(100) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    attendance_history NUMERIC(4,3) NOT NULL,
    waiting_days INTEGER NOT NULL,
    urgency_level INTEGER NOT NULL,
    normalized_attendance NUMERIC(6,5) NOT NULL,
    normalized_waiting_days NUMERIC(6,5) NOT NULL,
    normalized_urgency NUMERIC(6,5) NOT NULL,
    priority_score NUMERIC(8,5) NOT NULL,
    ranking_position INTEGER NOT NULL,
    notification_token_jti UUID,
    notification_sent_at TIMESTAMPTZ,
    response_at TIMESTAMPTZ,
    status participant_status_enum NOT NULL DEFAULT 'ranked',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_auction_participants_candidate UNIQUE (auction_id, waitlist_candidate_id),
    CONSTRAINT uq_auction_participants_rank UNIQUE (auction_id, ranking_position),
    CONSTRAINT chk_auction_participants_phone CHECK (phone ~ '^\+569[0-9]{8}$'),
    CONSTRAINT chk_auction_participants_attendance CHECK (attendance_history >= 0.0 AND attendance_history <= 1.0),
    CONSTRAINT chk_auction_participants_waiting_days CHECK (waiting_days >= 0),
    CONSTRAINT chk_auction_participants_urgency CHECK (urgency_level BETWEEN 1 AND 4),
    CONSTRAINT chk_auction_participants_rank CHECK (ranking_position > 0),
    CONSTRAINT chk_auction_participants_score CHECK (priority_score >= 0.0),
    CONSTRAINT chk_auction_participants_norm_attendance CHECK (normalized_attendance >= 0.0 AND normalized_attendance <= 1.0),
    CONSTRAINT chk_auction_participants_norm_waiting CHECK (normalized_waiting_days >= 0.0 AND normalized_waiting_days <= 1.0),
    CONSTRAINT chk_auction_participants_norm_urgency CHECK (normalized_urgency >= 0.0 AND normalized_urgency <= 1.0)
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL UNIQUE,
    correlation_id UUID NOT NULL UNIQUE,
    auction_id UUID NOT NULL UNIQUE REFERENCES auctions(id) ON DELETE CASCADE,
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    source_system_id UUID NOT NULL REFERENCES source_systems(id) ON DELETE RESTRICT,
    status transaction_status_enum NOT NULL,
    winner_participant_id UUID NULL REFERENCES auction_participants(id) ON DELETE SET NULL,
    winner_patient_id VARCHAR(100),
    winner_display_name VARCHAR(150),
    response_payload JSONB NOT NULL,
    return_attempts INTEGER NOT NULL DEFAULT 0,
    last_return_attempt_at TIMESTAMPTZ,
    reassigned_at TIMESTAMPTZ,
    elapsed_ms INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_transactions_elapsed_ms CHECK (elapsed_ms >= 0),
    CONSTRAINT chk_transactions_return_attempts CHECK (return_attempts >= 0)
);

CREATE TABLE IF NOT EXISTS weight_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    w1_attendance NUMERIC(4,3) NOT NULL,
    w2_waiting_time NUMERIC(4,3) NOT NULL,
    w3_urgency NUMERIC(4,3) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_weight_config_w1 CHECK (w1_attendance >= 0 AND w1_attendance <= 1),
    CONSTRAINT chk_weight_config_w2 CHECK (w2_waiting_time >= 0 AND w2_waiting_time <= 1),
    CONSTRAINT chk_weight_config_w3 CHECK (w3_urgency >= 0 AND w3_urgency <= 1),
    CONSTRAINT chk_weight_config_sum CHECK ((w1_attendance + w2_waiting_time + w3_urgency) = 1.000)
);

CREATE TABLE IF NOT EXISTS dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES auctions(id) ON DELETE SET NULL,
    transaction_id UUID,
    correlation_id UUID,
    source_system_id UUID REFERENCES source_systems(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    target_url TEXT,
    payload JSONB NOT NULL,
    error_message TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 3,
    status dead_letter_status_enum NOT NULL DEFAULT 'pending',
    last_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT chk_dead_letter_attempts CHECK (attempts >= 0)
);

ALTER TABLE auctions
    ADD CONSTRAINT fk_auctions_winner_participant
    FOREIGN KEY (winner_participant_id)
    REFERENCES auction_participants(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_source_systems_active
    ON source_systems (is_active);

CREATE INDEX IF NOT EXISTS idx_appointments_source_system
    ON appointments (source_system_id);

CREATE INDEX IF NOT EXISTS idx_appointments_status
    ON appointments (status);

CREATE INDEX IF NOT EXISTS idx_appointments_slot_date
    ON appointments (slot_date);

CREATE INDEX IF NOT EXISTS idx_auctions_status
    ON auctions (status);

CREATE INDEX IF NOT EXISTS idx_auctions_correlation_id
    ON auctions (correlation_id);

CREATE INDEX IF NOT EXISTS idx_auctions_transaction_id
    ON auctions (transaction_id);

CREATE INDEX IF NOT EXISTS idx_auctions_expires_at
    ON auctions (expires_at);

CREATE INDEX IF NOT EXISTS idx_waitlist_candidates_appointment
    ON waitlist_candidates (appointment_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_candidates_waiting_days
    ON waitlist_candidates (waiting_days DESC);

CREATE INDEX IF NOT EXISTS idx_auction_participants_auction
    ON auction_participants (auction_id);

CREATE INDEX IF NOT EXISTS idx_auction_participants_status
    ON auction_participants (status);

CREATE INDEX IF NOT EXISTS idx_auction_participants_score
    ON auction_participants (auction_id, priority_score DESC, ranking_position ASC);

CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON transactions (status);

CREATE INDEX IF NOT EXISTS idx_transactions_auction
    ON transactions (auction_id);

CREATE INDEX IF NOT EXISTS idx_transactions_appointment
    ON transactions (appointment_id);

CREATE INDEX IF NOT EXISTS idx_weight_config_active
    ON weight_config (is_active, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_dead_letter_status
    ON dead_letter_queue (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dead_letter_correlation_id
    ON dead_letter_queue (correlation_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_source_systems_updated_at ON source_systems;
CREATE TRIGGER trg_source_systems_updated_at
BEFORE UPDATE ON source_systems
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON appointments;
CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_auctions_updated_at ON auctions;
CREATE TRIGGER trg_auctions_updated_at
BEFORE UPDATE ON auctions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_auction_participants_updated_at ON auction_participants;
CREATE TRIGGER trg_auction_participants_updated_at
BEFORE UPDATE ON auction_participants
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;