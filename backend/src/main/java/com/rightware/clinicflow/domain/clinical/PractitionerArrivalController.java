package com.rightware.clinicflow.domain.clinical;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/**
 * Read-only clinical handoff from reception to the assigned practitioner.
 * Does not expose the reception queue or grant access to clinical reports.
 */
@RestController
@RequestMapping("/api/v1/practitioner/arrivals")
public class PractitionerArrivalController {
    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenants;
    private final AuditWriter audit;

    public PractitionerArrivalController(NamedParameterJdbcTemplate jdbc,
                                         TenantAccessService tenants,
                                         AuditWriter audit) {
        this.jdbc = jdbc;
        this.tenants = tenants;
        this.audit = audit;
    }

    @GetMapping
    @Transactional
    public List<ArrivalView> ownArrivals(
            @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Authentication auth) {
        var actor = tenants.requireMembership(auth, tenant);
        if (!"PRACTITIONER".equals(actor.role())) {
            throw new AccessDeniedException("Assigned practitioner required");
        }
        var arrivals = jdbc.query("""
            SELECT a.id AS appointment_id, c.queue_status, c.arrived_at, c.called_at
            FROM reception_checkins c
            JOIN appointments a
              ON a.tenant_id = c.tenant_id AND a.id = c.appointment_id
            WHERE c.tenant_id = :tenant
              AND a.practitioner_user_id = :practitioner
              AND a.starts_at >= :from AND a.starts_at < :to
              AND a.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
            ORDER BY c.arrived_at, a.id
            LIMIT 1000
            """, Map.of(
                "tenant", tenant, "practitioner", actor.userId(),
                "from", date.atStartOfDay(), "to", date.plusDays(1).atStartOfDay()),
            (rs, row) -> mapRow(rs));
        audit.write(tenant, actor.userId(),
            "PRACTITIONER_ARRIVALS_VIEWED", "Organization", tenant);
        return arrivals;
    }

    private static ArrivalView mapRow(ResultSet rs) throws SQLException {
        return new ArrivalView(
            rs.getObject("appointment_id", UUID.class),
            rs.getString("queue_status"),
            rs.getObject("arrived_at", OffsetDateTime.class),
            rs.getObject("called_at", OffsetDateTime.class));
    }

    public record ArrivalView(UUID appointmentId, String queueStatus,
                              OffsetDateTime arrivedAt, OffsetDateTime calledAt) {}
}
