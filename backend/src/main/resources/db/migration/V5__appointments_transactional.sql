-- CF-B5: internal appointment core. Clinic-local timestamps until tenant timezone ADR.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE appointments (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    patient_id UUID NOT NULL,
    practitioner_user_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    service_id UUID NOT NULL,
    starts_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED'
        CHECK (status IN ('REQUESTED','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW')),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_by UUID NOT NULL REFERENCES users(id),
    idempotency_key UUID NOT NULL,
    request_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id,id),
    FOREIGN KEY (tenant_id, practitioner_user_id)
        REFERENCES practitioner_profiles(tenant_id,user_id),
    FOREIGN KEY (tenant_id, unit_id)
        REFERENCES clinic_units(tenant_id,id),
    FOREIGN KEY (tenant_id, service_id)
        REFERENCES service_definitions(tenant_id,id),
    CONSTRAINT chk_appointment_time CHECK (ends_at > starts_at),
    CONSTRAINT uq_appointment_idempotency UNIQUE (tenant_id,created_by,idempotency_key),
    CONSTRAINT ex_appointment_practitioner_no_overlap EXCLUDE USING gist (
        tenant_id WITH =,
        practitioner_user_id WITH =,
        tsrange(starts_at,ends_at,'[)') WITH &&
    ) WHERE (status IN ('REQUESTED','CONFIRMED','IN_PROGRESS')),
    CONSTRAINT ex_appointment_patient_no_overlap EXCLUDE USING gist (
        tenant_id WITH =,
        patient_id WITH =,
        tsrange(starts_at,ends_at,'[)') WITH &&
    ) WHERE (status IN ('REQUESTED','CONFIRMED','IN_PROGRESS'))
);

CREATE INDEX ix_appointments_calendar
    ON appointments(tenant_id,starts_at,practitioner_user_id);
CREATE INDEX ix_appointments_patient
    ON appointments(tenant_id,patient_id,starts_at DESC);

CREATE TABLE appointment_events (
    tenant_id UUID NOT NULL,
    id UUID NOT NULL,
    appointment_id UUID NOT NULL,
    actor_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(40) NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    previous_starts_at TIMESTAMP WITHOUT TIME ZONE,
    new_starts_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(tenant_id,id),
    FOREIGN KEY(tenant_id,appointment_id) REFERENCES appointments(tenant_id,id)
);
CREATE INDEX ix_appointment_events_lookup
    ON appointment_events(tenant_id,appointment_id,occurred_at);
