CREATE TABLE user_invitations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    email VARCHAR(254) NOT NULL,
    display_name VARCHAR(160) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('RECEPTION','PRACTITIONER','INTERN')),
    token_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    invited_by UUID NOT NULL REFERENCES users(id),
    accepted_by UUID REFERENCES users(id),
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_invitation_token_hash UNIQUE (token_hash),
    CONSTRAINT chk_invitation_terminal_state CHECK (
        NOT (accepted_at IS NOT NULL AND revoked_at IS NOT NULL)
    )
);
CREATE INDEX ix_invitations_tenant_created
    ON user_invitations(tenant_id,created_at DESC);
CREATE UNIQUE INDEX ux_invitation_active_email_tenant
    ON user_invitations(tenant_id,lower(email))
    WHERE accepted_at IS NULL AND revoked_at IS NULL;
