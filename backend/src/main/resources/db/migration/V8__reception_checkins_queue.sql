-- CF-R01: operational reception check-in; no clinical data in this domain.
ALTER TABLE organizations
  ADD COLUMN time_zone VARCHAR(64) NOT NULL DEFAULT 'Africa/Maputo';

CREATE TABLE reception_checkins (
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  checked_in_by UUID NOT NULL REFERENCES users(id),
  arrived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  queue_status VARCHAR(16) NOT NULL DEFAULT 'WAITING'
    CHECK (queue_status IN ('WAITING', 'CALLED')),
  queue_version BIGINT NOT NULL DEFAULT 0 CHECK (queue_version >= 0),
  called_at TIMESTAMPTZ,
  called_by UUID REFERENCES users(id),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, appointment_id),
  FOREIGN KEY (tenant_id, appointment_id) REFERENCES appointments(tenant_id,id),
  CHECK ((queue_status='WAITING' AND called_at IS NULL AND called_by IS NULL)
    OR (queue_status='CALLED' AND called_at IS NOT NULL AND called_by IS NOT NULL))
);
CREATE INDEX ix_reception_checkins_arrival ON reception_checkins(tenant_id,arrived_at,id);

CREATE TABLE reception_queue_events (
  tenant_id UUID NOT NULL,
  id UUID NOT NULL,
  checkin_id UUID NOT NULL,
  actor_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(20) NOT NULL CHECK (action IN ('CHECK_IN','CALL')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,checkin_id) REFERENCES reception_checkins(tenant_id,id)
);
CREATE INDEX ix_reception_queue_events_checkin
  ON reception_queue_events(tenant_id,checkin_id,occurred_at);
