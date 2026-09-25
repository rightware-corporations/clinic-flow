-- CF-N01: additive nursing role and explicit unit assignments.
-- No automatic clinical-content grant is created by the NURSE role.
ALTER TABLE tenant_memberships DROP CONSTRAINT tenant_memberships_role_check;
ALTER TABLE tenant_memberships ADD CONSTRAINT tenant_memberships_role_check
    CHECK (role IN ('CLINIC_ADMIN','RECEPTION','PRACTITIONER','NURSE','INTERN','PATIENT'));

ALTER TABLE user_invitations DROP CONSTRAINT user_invitations_role_check;
ALTER TABLE user_invitations ADD CONSTRAINT user_invitations_role_check
    CHECK (role IN ('RECEPTION','PRACTITIONER','NURSE','INTERN'));

CREATE TABLE nursing_profiles (
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version>=0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id,user_id),
    FOREIGN KEY (tenant_id,user_id)
        REFERENCES tenant_memberships(tenant_id,user_id)
);

CREATE TABLE nursing_unit_assignments (
    tenant_id UUID NOT NULL,
    nurse_user_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id,nurse_user_id,unit_id),
    FOREIGN KEY (tenant_id,nurse_user_id)
        REFERENCES nursing_profiles(tenant_id,user_id),
    FOREIGN KEY (tenant_id,unit_id)
        REFERENCES clinic_units(tenant_id,id)
);
CREATE INDEX ix_nursing_unit_assignments_unit
    ON nursing_unit_assignments(tenant_id,unit_id);
