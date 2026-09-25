package com.rightware.clinicflow.domain.clinical;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * CF-J01A: a single-statement, metadata-only projection of an EXISTING handoff.
 *
 * This is not a clinical task, diagnosis, acuity classification, approval of
 * nursing notes or proof that the entire episode of care is complete.
 * No clinical text is copied, and reading never acknowledges any record.
 */
@RestController
@RequestMapping("/api/v1/practitioner/handoffs")
public class PractitionerHandoffController {
    private static final String HANDOFF_SQL = """
        SELECT a.id AS appointment_id,
               EXISTS (
                 SELECT 1 FROM reception_checkins c
                 WHERE c.tenant_id = a.tenant_id
                   AND c.appointment_id = a.id
               ) AS check_in_recorded,
               n.status AS published_nursing_status,
               COALESCE(corrections.total_count, 0) AS correction_count,
               COALESCE(corrections.pending_count, 0) AS pending_correction_receipts
        FROM appointments a
        JOIN organizations o
          ON o.id = a.tenant_id AND o.status = 'ACTIVE'
        JOIN tenant_memberships tm
          ON tm.tenant_id = a.tenant_id
         AND tm.user_id = :actor
         AND tm.active = TRUE AND tm.role = 'PRACTITIONER'
        JOIN practitioner_profiles p
          ON p.tenant_id = a.tenant_id
         AND p.user_id = :actor AND p.active = TRUE
        LEFT JOIN nursing_observations n
          ON n.tenant_id = a.tenant_id
         AND n.appointment_id = a.id
         AND n.status IN ('SUBMITTED', 'ACKNOWLEDGED')
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS total_count,
                 COUNT(*) FILTER (WHERE ad.acknowledged_at IS NULL) AS pending_count
          FROM nursing_observation_addenda ad
          WHERE ad.tenant_id = n.tenant_id
            AND ad.observation_id = n.id
        ) corrections ON TRUE
        WHERE a.tenant_id = :tenant
          AND a.id = :appointment
          AND a.practitioner_user_id = :actor
          AND a.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
        """;

    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenants;
    private final AuditWriter audit;

    public PractitionerHandoffController(NamedParameterJdbcTemplate jdbc,
                                         TenantAccessService tenants,
                                         AuditWriter audit) {
        this.jdbc = jdbc;
        this.tenants = tenants;
        this.audit = audit;
    }

    @GetMapping("/{appointmentId}")
    @Transactional
    public ResponseEntity<HandoffView> getOwnHandoff(
            @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
            @PathVariable UUID appointmentId,
            Authentication authentication) {
        try {
            var actor = tenants.requireMembership(authentication, tenant);
            if (!"PRACTITIONER".equals(actor.role())) {
                throw new AccessDeniedException("Practitioner role required");
            }

            // The relation to the currently assigned practitioner is checked IN SQL.
            // A missing, foreign, cancelled or unassigned appointment looks identical.
            List<Snapshot> rows = jdbc.query(HANDOFF_SQL,
                Map.of("tenant", tenant, "actor", actor.userId(),
                       "appointment", appointmentId),
                PractitionerHandoffController::mapSnapshot);
            if (rows.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "HANDOFF_NOT_FOUND");
            }

            Snapshot snapshot = rows.getFirst();
            String indicator = classify(snapshot);
            // Successful reads are audited in the same transaction, without PHI.
            audit.write(tenant, actor.userId(), "PRACTITIONER_HANDOFF_VIEWED",
                "Appointment", appointmentId);
            HandoffView view = new HandoffView(
                snapshot.appointmentId(),
                indicator,
                snapshot.checkInRecorded(),
                snapshot.publishedNursingStatus(),
                snapshot.correctionCount(),
                snapshot.pendingCorrectionReceipts(),
                true,
                OffsetDateTime.now(ZoneOffset.UTC));

            return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .header(HttpHeaders.VARY, "Cookie", "X-Clinicflow-Tenant")
                .header("X-Content-Type-Options", "nosniff")
                .body(view);
        } catch (DataAccessException unavailable) {
            // No SQL, free text, database identifiers or clinical payload in the response.
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "HANDOFF_SOURCE_UNAVAILABLE");
        }
    }

    static String classify(Snapshot row) {
        long total = row.correctionCount();
        long pending = row.pendingCorrectionReceipts();
        if (total < 0 || pending < 0 || pending > total) return "INCONSISTENT";
        if (!row.checkInRecorded()) {
            return row.publishedNursingStatus() == null && total == 0
                ? "NO_CHECK_IN" : "INCONSISTENT";
        }
        if (row.publishedNursingStatus() == null) {
            return total == 0 ? "NO_SUBMITTED_NOTE" : "INCONSISTENT";
        }
        return switch (row.publishedNursingStatus()) {
            case "SUBMITTED" -> "ORIGINAL_RECEIPT_PENDING";
            case "ACKNOWLEDGED" -> pending > 0
                ? "CORRECTION_RECEIPTS_PENDING" : "ALL_RECEIPTS_RECORDED";
            default -> "INCONSISTENT";
        };
    }

    private static Snapshot mapSnapshot(ResultSet rs, int index) throws SQLException {
        return new Snapshot(
            rs.getObject("appointment_id", UUID.class),
            rs.getBoolean("check_in_recorded"),
            rs.getString("published_nursing_status"),
            rs.getLong("correction_count"),
            rs.getLong("pending_correction_receipts"));
    }

    record Snapshot(UUID appointmentId, boolean checkInRecorded,
                    String publishedNursingStatus, long correctionCount,
                    long pendingCorrectionReceipts) {}

    public record HandoffView(UUID appointmentId, String indicator,
                              boolean checkInRecorded, String publishedNursingNote,
                              long correctionCount, long pendingCorrectionReceipts,
                              boolean receiptOnly, OffsetDateTime sourceObservedAt) {}
}
