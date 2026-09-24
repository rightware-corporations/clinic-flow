CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(160) NOT NULL CHECK (length(trim(name)) > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    display_name VARCHAR(160) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_users_email_ci ON users (lower(email));

CREATE TABLE tenant_memberships (
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(32) NOT NULL CHECK (role IN
        ('CLINIC_ADMIN', 'RECEPTION', 'PRACTITIONER', 'INTERN', 'PATIENT')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX ix_memberships_user ON tenant_memberships (user_id, active);

CREATE TABLE clinic_units (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(160) NOT NULL CHECK (length(trim(name)) > 0),
    address VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_clinic_unit_tenant_id UNIQUE (tenant_id, id)
);
CREATE UNIQUE INDEX ux_clinic_unit_name_ci
    ON clinic_units (tenant_id, lower(name)) WHERE active;

CREATE TABLE service_definitions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(160) NOT NULL CHECK (length(trim(name)) > 0),
    slug VARCHAR(180) NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 5 AND 480),
    price NUMERIC(12,2) CHECK (price >= 0),
    currency_code CHAR(3) CHECK (currency_code ~ '^[A-Z]{3}$'),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_service_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_service_tenant_slug UNIQUE (tenant_id, slug),
    CONSTRAINT chk_service_money CHECK (
        (price IS NULL AND currency_code IS NULL) OR
        (price IS NOT NULL AND currency_code IS NOT NULL))
);
CREATE INDEX ix_services_active ON service_definitions (tenant_id, active);

CREATE TABLE audit_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    actor_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(80) NOT NULL,
    resource_type VARCHAR(80) NOT NULL,
    resource_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_tenant_time ON audit_events (tenant_id, occurred_at DESC);
-- No UPDATE/DELETE application endpoint; retention policy remains a separate decision.
