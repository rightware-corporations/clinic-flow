-- Patient registry: tenant-owned demographics only. Clinical reports live in a separate domain.
CREATE TABLE patients (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(160) NOT NULL CHECK (length(trim(name)) > 0),
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL CHECK (gender IN ('M', 'F', 'OTHER', 'NOT_DISCLOSED')),
    phone VARCHAR(40),
    email VARCHAR(254),
    address VARCHAR(500),
    national_id VARCHAR(100),
    health_number VARCHAR(100),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES users(id),
    CONSTRAINT pk_patients PRIMARY KEY (tenant_id, id)
);

CREATE INDEX ix_patients_name_active
    ON patients (tenant_id, lower(name)) WHERE archived_at IS NULL;
CREATE INDEX ix_patients_created_active
    ON patients (tenant_id, created_at DESC) WHERE archived_at IS NULL;
-- No unique national/health number yet: format and deduplication are jurisdiction-specific.
-- Future tenant-scoped foreign keys must reference (tenant_id, id), never id alone.
