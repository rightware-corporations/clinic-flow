-- CF-N02A: appointment-bound nursing observation; no automated triage or diagnosis.
CREATE TABLE nursing_observations (
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    id UUID NOT NULL,
    appointment_id UUID NOT NULL,
    author_id UUID NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','SUBMITTED','ACKNOWLEDGED')),
    presenting_concern VARCHAR(1000) NOT NULL DEFAULT '',
    observation_notes VARCHAR(3000) NOT NULL DEFAULT '',
    temperature_c NUMERIC(6,2),
    heart_rate INTEGER,
    respiratory_rate INTEGER,
    spo2_percent INTEGER,
    systolic_mmhg INTEGER,
    diastolic_mmhg INTEGER,
    measured_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version>=0),
    submitted_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id,id),
    UNIQUE (tenant_id,appointment_id),
    FOREIGN KEY (tenant_id,appointment_id) REFERENCES appointments(tenant_id,id),
    FOREIGN KEY (tenant_id,author_id) REFERENCES nursing_profiles(tenant_id,user_id),
    FOREIGN KEY (tenant_id,acknowledged_by)
      REFERENCES practitioner_profiles(tenant_id,user_id),
    CHECK (temperature_c IS NULL OR temperature_c BETWEEN -100 AND 100),
    CHECK (heart_rate IS NULL OR heart_rate BETWEEN 0 AND 1000),
    CHECK (respiratory_rate IS NULL OR respiratory_rate BETWEEN 0 AND 1000),
    CHECK (spo2_percent IS NULL OR spo2_percent BETWEEN 0 AND 100),
    CHECK (systolic_mmhg IS NULL OR systolic_mmhg BETWEEN 0 AND 1000),
    CHECK (diastolic_mmhg IS NULL OR diastolic_mmhg BETWEEN 0 AND 1000),
    CHECK ((
      temperature_c IS NULL AND heart_rate IS NULL AND respiratory_rate IS NULL
      AND spo2_percent IS NULL AND systolic_mmhg IS NULL AND diastolic_mmhg IS NULL
    ) = (measured_at IS NULL)),
    CHECK ((status='DRAFT' AND submitted_at IS NULL
        AND acknowledged_at IS NULL AND acknowledged_by IS NULL)
      OR (status='SUBMITTED' AND submitted_at IS NOT NULL
        AND acknowledged_at IS NULL AND acknowledged_by IS NULL)
      OR (status='ACKNOWLEDGED' AND submitted_at IS NOT NULL
        AND acknowledged_at IS NOT NULL AND acknowledged_by IS NOT NULL))
);
CREATE INDEX ix_nursing_observations_author
  ON nursing_observations(tenant_id,author_id,created_at DESC);

CREATE TABLE nursing_observation_events (
    tenant_id UUID NOT NULL,
    id UUID NOT NULL,
    observation_id UUID NOT NULL,
    actor_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(24) NOT NULL CHECK (action IN ('CREATE','EDIT_DRAFT','SUBMIT','ACKNOWLEDGE')),
    observation_version BIGINT NOT NULL CHECK (observation_version>=0),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id,id),
    FOREIGN KEY (tenant_id,observation_id) REFERENCES nursing_observations(tenant_id,id)
);

-- Immutable identity throughout; finalized source content cannot be updated.
-- Practitioner acknowledgement is a status/receipt only, never a clinical countersign.
CREATE FUNCTION clinicflow_guard_nursing_observation() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'NURSING_OBSERVATION_DELETE_FORBIDDEN' USING ERRCODE='P0001';
  END IF;
  IF ROW(NEW.tenant_id,NEW.id,NEW.appointment_id,NEW.author_id,NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.tenant_id,OLD.id,OLD.appointment_id,OLD.author_id,OLD.created_at) THEN
    RAISE EXCEPTION 'NURSING_OBSERVATION_IDENTITY_IMMUTABLE' USING ERRCODE='P0001';
  END IF;
  IF OLD.status='DRAFT' THEN
    IF NEW.status NOT IN ('DRAFT','SUBMITTED')
       OR NEW.acknowledged_at IS NOT NULL OR NEW.acknowledged_by IS NOT NULL THEN
      RAISE EXCEPTION 'INVALID_NURSING_DRAFT_TRANSITION' USING ERRCODE='P0001';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='SUBMITTED' AND NEW.status='ACKNOWLEDGED'
     AND NEW.acknowledged_at IS NOT NULL AND NEW.acknowledged_by IS NOT NULL
     AND NEW.version=OLD.version+1
     AND ROW(NEW.presenting_concern,NEW.observation_notes,NEW.temperature_c,
       NEW.heart_rate,NEW.respiratory_rate,NEW.spo2_percent,NEW.systolic_mmhg,
       NEW.diastolic_mmhg,NEW.measured_at,NEW.submitted_at)
       IS NOT DISTINCT FROM
       ROW(OLD.presenting_concern,OLD.observation_notes,OLD.temperature_c,
       OLD.heart_rate,OLD.respiratory_rate,OLD.spo2_percent,OLD.systolic_mmhg,
       OLD.diastolic_mmhg,OLD.measured_at,OLD.submitted_at) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'SUBMITTED_NURSING_OBSERVATION_IMMUTABLE' USING ERRCODE='P0001';
END;
$$;
CREATE TRIGGER tr_guard_nursing_observations
BEFORE UPDATE OR DELETE ON nursing_observations
FOR EACH ROW EXECUTE FUNCTION clinicflow_guard_nursing_observation();

CREATE TRIGGER tr_guard_nursing_observation_events
BEFORE UPDATE OR DELETE ON nursing_observation_events
FOR EACH ROW EXECUTE FUNCTION clinicflow_reject_append_only_mutation();
