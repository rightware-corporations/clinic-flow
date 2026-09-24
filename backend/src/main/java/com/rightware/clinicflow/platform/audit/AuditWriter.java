package com.rightware.clinicflow.platform.audit;

import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

/** Call from the same transaction as the audited domain mutation. No clinical payloads. */
@Service
public class AuditWriter {
    private final NamedParameterJdbcTemplate jdbc;

    public AuditWriter(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void write(UUID tenantId, UUID actorId, String action,
                      String resourceType, UUID resourceId) {
        jdbc.update("""
            INSERT INTO audit_events (id, tenant_id, actor_id, action, resource_type, resource_id)
            VALUES (:id, :tenant, :actor, :action, :type, :resource)
            """, Map.of("id", UUID.randomUUID(), "tenant", tenantId,
                "actor", actorId, "action", action,
                "type", resourceType, "resource", resourceId));
    }
}
