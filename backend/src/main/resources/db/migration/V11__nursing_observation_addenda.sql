-- CF-N03: immutable additive corrections to submitted nursing observations.
-- No clinical thresholds, scores or change to the submitted original.
ALTER TABLE nursing_observations
  ADD CONSTRAINT uq_nursing_observation_author
  UNIQUE (tenant_id,id,author_id);

CREATE TABLE nursing_observation_addenda (
  tenant_id UUID NOT NULL,
  id UUID NOT NULL,
  observation_id UUID NOT NULL,
  author_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 3000),
  idempotency_key UUID NOT NULL,
  content_sha CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,observation_id,author_id)
    REFERENCES nursing_observations(tenant_id,id,author_id),
  FOREIGN KEY (tenant_id,acknowledged_by)
    REFERENCES practitioner_profiles(tenant_id,user_id),
  UNIQUE (tenant_id,observation_id,author_id,idempotency_key),
  CHECK ((acknowledged_at IS NULL AND acknowledged_by IS NULL)
      OR (acknowledged_at IS NOT NULL AND acknowledged_by IS NOT NULL))
);
CREATE INDEX ix_nursing_addenda_note_date
  ON nursing_observation_addenda(tenant_id,observation_id,created_at,id);

-- Append-only clinical content; a practitioner may only mark receipt, once.
CREATE FUNCTION clinicflow_guard_nursing_addendum() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'NURSING_ADDENDUM_DELETE_FORBIDDEN' USING ERRCODE='P0001';
  END IF;
  IF OLD.acknowledged_at IS NOT NULL
     OR NEW.acknowledged_at IS NULL
     OR NEW.acknowledged_by IS NULL
     OR ROW(NEW.tenant_id,NEW.id,NEW.observation_id,NEW.author_id,NEW.content,
            NEW.idempotency_key,NEW.content_sha,NEW.created_at)
        IS DISTINCT FROM
        ROW(OLD.tenant_id,OLD.id,OLD.observation_id,OLD.author_id,OLD.content,
            OLD.idempotency_key,OLD.content_sha,OLD.created_at)
     OR NOT EXISTS (
       SELECT 1 FROM nursing_observations n
       JOIN appointments a ON a.tenant_id=n.tenant_id AND a.id=n.appointment_id
       JOIN practitioner_profiles pp
         ON pp.tenant_id=a.tenant_id AND pp.user_id=a.practitioner_user_id
           AND pp.active
       JOIN tenant_memberships tm
         ON tm.tenant_id=a.tenant_id AND tm.user_id=pp.user_id
           AND tm.role='PRACTITIONER' AND tm.active
       WHERE n.tenant_id=OLD.tenant_id AND n.id=OLD.observation_id
         AND n.status IN ('SUBMITTED','ACKNOWLEDGED')
         AND pp.user_id=NEW.acknowledged_by
     ) THEN
    RAISE EXCEPTION 'NURSING_ADDENDUM_IMMUTABLE' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tr_guard_nursing_addenda
BEFORE UPDATE OR DELETE ON nursing_observation_addenda
FOR EACH ROW EXECUTE FUNCTION clinicflow_guard_nursing_addendum();
