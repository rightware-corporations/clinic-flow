CREATE TABLE practitioner_availability_rules (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    practitioner_user_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_interval_minutes INTEGER NOT NULL DEFAULT 15
        CHECK (slot_interval_minutes BETWEEN 5 AND 120),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, practitioner_user_id)
        REFERENCES practitioner_profiles (tenant_id, user_id),
    FOREIGN KEY (tenant_id, unit_id)
        REFERENCES clinic_units (tenant_id, id),
    CONSTRAINT chk_availability_time CHECK (end_time > start_time)
);

CREATE INDEX ix_availability_lookup
    ON practitioner_availability_rules
        (tenant_id, practitioner_user_id, day_of_week, active);

CREATE TABLE practitioner_schedule_blocks (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    practitioner_user_id UUID NOT NULL,
    starts_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    reason VARCHAR(250),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, practitioner_user_id)
        REFERENCES practitioner_profiles (tenant_id, user_id),
    CONSTRAINT chk_schedule_block_time CHECK (ends_at > starts_at)
);

CREATE INDEX ix_schedule_blocks_lookup
    ON practitioner_schedule_blocks
        (tenant_id, practitioner_user_id, starts_at, ends_at);

-- Times are clinic-local in CF-B4. Organization timezone is still an explicit
-- production decision and must be frozen before external/public booking.
