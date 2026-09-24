CREATE TABLE specialties (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(160) NOT NULL CHECK (length(trim(name)) > 0),
    code VARCHAR(80) NOT NULL CHECK (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT uq_specialty_code UNIQUE (tenant_id, code)
);

CREATE TABLE practitioner_profiles (
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    specialty_id UUID,
    professional_title VARCHAR(120),
    license_number VARCHAR(120),
    bio VARCHAR(1000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id),
    FOREIGN KEY (tenant_id, user_id)
        REFERENCES tenant_memberships (tenant_id, user_id),
    FOREIGN KEY (tenant_id, specialty_id)
        REFERENCES specialties (tenant_id, id)
);

CREATE TABLE practitioner_units (
    tenant_id UUID NOT NULL,
    practitioner_user_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, practitioner_user_id, unit_id),
    FOREIGN KEY (tenant_id, practitioner_user_id)
        REFERENCES practitioner_profiles (tenant_id, user_id),
    FOREIGN KEY (tenant_id, unit_id)
        REFERENCES clinic_units (tenant_id, id)
);

CREATE TABLE practitioner_services (
    tenant_id UUID NOT NULL,
    practitioner_user_id UUID NOT NULL,
    service_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, practitioner_user_id, service_id),
    FOREIGN KEY (tenant_id, practitioner_user_id)
        REFERENCES practitioner_profiles (tenant_id, user_id),
    FOREIGN KEY (tenant_id, service_id)
        REFERENCES service_definitions (tenant_id, id)
);

CREATE INDEX ix_practitioner_profiles_active
    ON practitioner_profiles (tenant_id, active);
CREATE INDEX ix_practitioner_units_unit
    ON practitioner_units (tenant_id, unit_id);
CREATE INDEX ix_practitioner_services_service
    ON practitioner_services (tenant_id, service_id);
