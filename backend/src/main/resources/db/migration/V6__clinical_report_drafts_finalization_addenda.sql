-- CF-B6. Synthetic data only until privacy/security and retention policies are approved.
-- The clinical author must be the professional assigned to the same appointment/patient.
ALTER TABLE appointments
    ADD CONSTRAINT uq_appointment_clinical_relationship
    UNIQUE (tenant_id, id, patient_id, practitioner_user_id);

CREATE TABLE clinical_reports (
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    id UUID NOT NULL,
    appointment_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    author_id UUID NOT NULL,
    report_type VARCHAR(24) NOT NULL
        CHECK (report_type IN ('CONSULTATION','DIAGNOSTIC','FOLLOW_UP')),
    status VARCHAR(12) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','FINALIZED')),
    symptoms TEXT NOT NULL DEFAULT '',
    diagnosis TEXT NOT NULL DEFAULT '',
    observations TEXT NOT NULL DEFAULT '',
    treatment TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_clinical_reports PRIMARY KEY (tenant_id, id),
    CONSTRAINT uq_report_per_appointment_author
        UNIQUE (tenant_id, appointment_id, author_id),
    CONSTRAINT fk_report_appointment_author
        FOREIGN KEY (tenant_id, appointment_id, patient_id, author_id)
        REFERENCES appointments(tenant_id,id,patient_id,practitioner_user_id),
    CONSTRAINT chk_report_finalization
        CHECK ((status = 'DRAFT' AND finalized_at IS NULL) OR
               (status = 'FINALIZED' AND finalized_at IS NOT NULL))
);
CREATE INDEX ix_clinical_reports_author
    ON clinical_reports(tenant_id,author_id,updated_at DESC);

CREATE TABLE clinical_report_addenda (
    tenant_id UUID NOT NULL,
    id UUID NOT NULL,
    report_id UUID NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL CHECK (length(trim(content)) > 0),
    idempotency_key UUID NOT NULL,
    content_sha CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id,id),
    FOREIGN KEY (tenant_id,report_id) REFERENCES clinical_reports(tenant_id,id),
    CONSTRAINT uq_clinical_addendum_idempotency
        UNIQUE (tenant_id,report_id,author_id,idempotency_key)
);
CREATE INDEX ix_clinical_addenda_report
    ON clinical_report_addenda(tenant_id,report_id,created_at);

CREATE TABLE clinical_report_events (
    tenant_id UUID NOT NULL,
    id UUID NOT NULL,
    report_id UUID NOT NULL,
    actor_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(32) NOT NULL
        CHECK (action IN ('CREATE','EDIT_DRAFT','FINALIZE','ADD_ADDENDUM')),
    report_version BIGINT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id,id),
    FOREIGN KEY (tenant_id,report_id) REFERENCES clinical_reports(tenant_id,id)
);

-- Defence in depth: finalized source documents cannot be edited,
-- draft reports cannot be hard-deleted, addenda and events are append-only.
CREATE FUNCTION clinicflow_guard_clinical_report() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'CLINICAL_REPORT_DELETE_FORBIDDEN'
            USING ERRCODE='P0001';
    END IF;
    IF OLD.status = 'FINALIZED' THEN
        RAISE EXCEPTION 'FINALIZED_REPORT_IMMUTABLE'
            USING ERRCODE='P0001';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER tr_guard_clinical_report
BEFORE UPDATE OR DELETE ON clinical_reports
FOR EACH ROW EXECUTE FUNCTION clinicflow_guard_clinical_report();

CREATE FUNCTION clinicflow_reject_append_only_mutation() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'APPEND_ONLY_CLINICAL_RECORD'
        USING ERRCODE='P0001';
END;
$$;
CREATE TRIGGER tr_guard_clinical_addenda
BEFORE UPDATE OR DELETE ON clinical_report_addenda
FOR EACH ROW EXECUTE FUNCTION clinicflow_reject_append_only_mutation();
CREATE TRIGGER tr_guard_clinical_events
BEFORE UPDATE OR DELETE ON clinical_report_events
FOR EACH ROW EXECUTE FUNCTION clinicflow_reject_append_only_mutation();
