package com.rightware.clinicflow.domain.nursing;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * CF-N03: own observation history, immutable nurse addenda, and independent
 * practitioner receipt for each correction. Never calculates clinical priority.
 */
@RestController
@RequestMapping("/api/v1")
public class NursingContinuityController {
    private static final int PAGE_SIZE = 20;
    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenants;
    private final AuditWriter audit;

    public NursingContinuityController(NamedParameterJdbcTemplate jdbc,
                                        TenantAccessService tenants, AuditWriter audit) {
        this.jdbc = jdbc;
        this.tenants = tenants;
        this.audit = audit;
    }

    private static final String NURSE_HISTORY_FROM = """
        FROM nursing_observations n
        JOIN appointments a
          ON a.tenant_id=n.tenant_id AND a.id=n.appointment_id
        JOIN nursing_unit_assignments nu
          ON nu.tenant_id=a.tenant_id AND nu.unit_id=a.unit_id
          AND nu.nurse_user_id=n.author_id
        JOIN clinic_units cu
          ON cu.tenant_id=a.tenant_id AND cu.id=a.unit_id AND cu.active
        JOIN patients p
          ON p.tenant_id=a.tenant_id AND p.id=a.patient_id
        JOIN service_definitions sd
          ON sd.tenant_id=a.tenant_id AND sd.id=a.service_id
        WHERE n.tenant_id=:tenant AND n.author_id=:nurse
          AND p.archived_at IS NULL
          AND a.status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')
        """;

    private static final String HISTORY_SELECT = """
        SELECT n.id AS observation_id,n.appointment_id,p.name AS patient_name,
          cu.name AS unit_name,sd.name AS service_name,a.starts_at,n.status,
          n.created_at,n.submitted_at,n.acknowledged_at,
          (SELECT count(*) FROM nursing_observation_addenda ad
           WHERE ad.tenant_id=n.tenant_id AND ad.observation_id=n.id) AS correction_count
        """;

    @GetMapping("/nursing/observations/history")
    @Transactional
    public HistoryPage history(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                               @RequestParam(defaultValue="0") int page,
                               Authentication auth) {
        UUID nurse = requireRole(tenant, auth, "NURSE");
        checkPage(page);
        var args = new MapSqlParameterSource().addValue("tenant", tenant)
            .addValue("nurse", nurse).addValue("limit", PAGE_SIZE)
            .addValue("offset", page * (long) PAGE_SIZE);
        Long total = jdbc.queryForObject(
            "SELECT count(*) " + NURSE_HISTORY_FROM, args, Long.class);
        List<HistoryItem> items = jdbc.query(
            HISTORY_SELECT + NURSE_HISTORY_FROM
                + " ORDER BY n.created_at DESC,n.id DESC LIMIT :limit OFFSET :offset",
            args, (rs, row) -> historyItem(rs));
        audit.write(tenant, nurse, "NURSING_OBSERVATION_HISTORY_READ", "Organization", tenant);
        return new HistoryPage(items, total == null ? 0 : total, page, PAGE_SIZE);
    }

    @GetMapping("/nursing/observations/history/{appointmentId}")
    @Transactional
    public HistoryItem historyDetail(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                     @PathVariable UUID appointmentId,
                                     Authentication auth) {
        UUID nurse = requireRole(tenant, auth, "NURSE");
        var args = Map.of("tenant", tenant, "nurse", nurse, "appointment", appointmentId);
        List<HistoryItem> results = jdbc.query(
            HISTORY_SELECT + NURSE_HISTORY_FROM + " AND n.appointment_id=:appointment",
            args, (rs, row) -> historyItem(rs));
        if (results.isEmpty()) notFound();
        HistoryItem result = results.getFirst();
        audit.write(tenant, nurse, "NURSING_OBSERVATION_HISTORY_DETAIL_READ",
            "NursingObservation", result.observationId());
        return result;
    }

    @PostMapping("/nursing/observations/{appointmentId}/addenda")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Correction createCorrection(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                       @PathVariable UUID appointmentId,
                                       @RequestHeader("Idempotency-Key") UUID key,
                                       @Valid @RequestBody CorrectionInput input,
                                       Authentication auth) {
        UUID nurse = requireRole(tenant, auth, "NURSE");
        Note note = findNurseNote(tenant, appointmentId, nurse, true);
        ensureSubmitted(note);
        String content = input.content().trim();
        String hash = sha256(content);
        var args = Map.of("tenant", tenant, "observation", note.id(),
            "author", nurse, "key", key);
        List<CorrectionFingerprint> previous = jdbc.query("""
            SELECT id,content_sha FROM nursing_observation_addenda
            WHERE tenant_id=:tenant AND observation_id=:observation
              AND author_id=:author AND idempotency_key=:key
            """, args, (rs, row) -> new CorrectionFingerprint(
                rs.getObject("id", UUID.class), rs.getString("content_sha").trim()));
        if (!previous.isEmpty()) {
            if (!hash.equals(previous.getFirst().hash())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "NURSING_CORRECTION_IDEMPOTENCY_CONFLICT");
            }
            return findCorrection(tenant, previous.getFirst().id(), note.id());
        }
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO nursing_observation_addenda(
              tenant_id,id,observation_id,author_id,content,idempotency_key,content_sha)
            VALUES(:tenant,:id,:observation,:author,:content,:key,:hash)
            """, new MapSqlParameterSource()
                .addValue("tenant", tenant).addValue("id", id)
                .addValue("observation", note.id()).addValue("author", nurse)
                .addValue("content", content).addValue("key", key).addValue("hash", hash));
        audit.write(tenant, nurse, "NURSING_CORRECTION_CREATED",
            "NursingObservation", note.id());
        return findCorrection(tenant, id, note.id());
    }

    @GetMapping("/nursing/observations/{appointmentId}/addenda")
    @Transactional
    public CorrectionPage ownCorrections(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                         @PathVariable UUID appointmentId,
                                         @RequestParam(defaultValue="0") int page,
                                         Authentication auth) {
        UUID nurse = requireRole(tenant, auth, "NURSE");
        Note note = findNurseNote(tenant, appointmentId, nurse, false);
        ensureSubmitted(note);
        CorrectionPage results = corrections(tenant, note.id(), page);
        audit.write(tenant, nurse, "NURSING_CORRECTIONS_READ",
            "NursingObservation", note.id());
        return results;
    }

    @GetMapping("/practitioner/nursing-observations/{appointmentId}/addenda")
    @Transactional
    public CorrectionPage practitionerCorrections(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID appointmentId,
        @RequestParam(defaultValue="0") int page,
        Authentication auth) {
        UUID practitioner = requireRole(tenant, auth, "PRACTITIONER");
        Note note = findPractitionerNote(tenant, appointmentId, practitioner);
        CorrectionPage results = corrections(tenant, note.id(), page);
        audit.write(tenant, practitioner, "NURSING_CORRECTIONS_PRACTITIONER_READ",
            "NursingObservation", note.id());
        return results;
    }

    @PostMapping("/practitioner/nursing-observations/{appointmentId}/addenda/{correctionId}/acknowledge")
    @Transactional
    public Correction acknowledgeCorrection(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID appointmentId,
        @PathVariable UUID correctionId,
        Authentication auth) {
        UUID practitioner = requireRole(tenant, auth, "PRACTITIONER");
        Note note = findPractitionerNote(tenant, appointmentId, practitioner);
        // Serialize concurrent receipts of this correction, without changing original content.
        List<Correction> locked = jdbc.query("""
            SELECT ad.id,ad.observation_id,ad.author_id,ad.content,ad.created_at,
                   ad.acknowledged_at,ad.acknowledged_by
            FROM nursing_observation_addenda ad
            WHERE ad.tenant_id=:tenant AND ad.observation_id=:observation
              AND ad.id=:id
            FOR UPDATE OF ad
            """, Map.of("tenant", tenant, "observation", note.id(), "id", correctionId),
            (rs, row) -> mapCorrection(rs));
        if (locked.isEmpty()) notFound();
        Correction existing = locked.getFirst();
        if (existing.acknowledgedAt() != null) return existing;
        int changed = jdbc.update("""
            UPDATE nursing_observation_addenda
            SET acknowledged_at=now(),acknowledged_by=:practitioner
            WHERE tenant_id=:tenant AND observation_id=:observation
              AND id=:id AND acknowledged_at IS NULL
            """, Map.of("tenant", tenant, "observation", note.id(),
                "id", correctionId, "practitioner", practitioner));
        if (changed != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "STALE_NURSING_CORRECTION_RECEIPT");
        }
        audit.write(tenant, practitioner, "NURSING_CORRECTION_ACKNOWLEDGED",
            "NursingObservation", note.id());
        return findCorrection(tenant, correctionId, note.id());
    }

    private UUID requireRole(UUID tenant, Authentication auth, String role) {
        var access = tenants.requireMembership(auth, tenant);
        if (!role.equals(access.role())) {
            throw new AccessDeniedException(role + " required");
        }
        String query = role.equals("NURSE")
            ? "SELECT count(*) FROM nursing_profiles WHERE tenant_id=:tenant AND user_id=:actor"
            : "SELECT count(*) FROM practitioner_profiles WHERE tenant_id=:tenant AND user_id=:actor AND active";
        Integer count = jdbc.queryForObject(query,
            Map.of("tenant", tenant, "actor", access.userId()), Integer.class);
        if (count == null || count == 0) {
            throw new AccessDeniedException("Active clinical profile required");
        }
        return access.userId();
    }

    private Note findNurseNote(UUID tenant, UUID appointment, UUID author, boolean lock) {
        String query = """
            SELECT n.id,n.appointment_id,n.author_id,n.status
            FROM nursing_observations n
            JOIN appointments a ON a.tenant_id=n.tenant_id AND a.id=n.appointment_id
            JOIN nursing_unit_assignments nu
              ON nu.tenant_id=a.tenant_id AND nu.unit_id=a.unit_id
              AND nu.nurse_user_id=:author
            JOIN clinic_units cu
              ON cu.tenant_id=a.tenant_id AND cu.id=a.unit_id AND cu.active
            JOIN patients p ON p.tenant_id=a.tenant_id AND p.id=a.patient_id
            WHERE n.tenant_id=:tenant AND n.appointment_id=:appointment
              AND n.author_id=:author AND p.archived_at IS NULL
              AND a.status IN ('CONFIRMED','IN_PROGRESS','COMPLETED')
            """ + (lock ? " FOR UPDATE OF n" : "");
        List<Note> notes = jdbc.query(query,
            Map.of("tenant", tenant, "appointment", appointment, "author", author),
            (rs, row) -> new Note(rs.getObject("id", UUID.class),
                rs.getObject("appointment_id", UUID.class),
                rs.getObject("author_id", UUID.class), rs.getString("status")));
        if (notes.isEmpty()) notFound();
        return notes.getFirst();
    }

    private Note findPractitionerNote(UUID tenant, UUID appointment, UUID practitioner) {
        List<Note> notes = jdbc.query("""
            SELECT n.id,n.appointment_id,n.author_id,n.status
            FROM nursing_observations n
            JOIN appointments a ON a.tenant_id=n.tenant_id AND a.id=n.appointment_id
            WHERE n.tenant_id=:tenant AND n.appointment_id=:appointment
              AND a.practitioner_user_id=:practitioner
              AND n.status IN ('SUBMITTED','ACKNOWLEDGED')
            """, Map.of("tenant", tenant, "appointment", appointment,
                "practitioner", practitioner),
            (rs, row) -> new Note(rs.getObject("id", UUID.class),
                rs.getObject("appointment_id", UUID.class),
                rs.getObject("author_id", UUID.class), rs.getString("status")));
        if (notes.isEmpty()) notFound();
        return notes.getFirst();
    }

    private static void ensureSubmitted(Note note) {
        if ("DRAFT".equals(note.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "SUBMITTED_NURSING_OBSERVATION_REQUIRED");
        }
    }

    private CorrectionPage corrections(UUID tenant, UUID noteId, int page) {
        checkPage(page);
        var args = new MapSqlParameterSource().addValue("tenant", tenant)
            .addValue("observation", noteId).addValue("limit", PAGE_SIZE)
            .addValue("offset", page * (long) PAGE_SIZE);
        Long total = jdbc.queryForObject("""
            SELECT count(*) FROM nursing_observation_addenda
            WHERE tenant_id=:tenant AND observation_id=:observation
            """, args, Long.class);
        List<Correction> items = jdbc.query("""
            SELECT id,observation_id,author_id,content,created_at,
                   acknowledged_at,acknowledged_by
            FROM nursing_observation_addenda
            WHERE tenant_id=:tenant AND observation_id=:observation
            ORDER BY created_at DESC,id DESC LIMIT :limit OFFSET :offset
            """, args, (rs, row) -> mapCorrection(rs));
        return new CorrectionPage(items, total == null ? 0 : total, page, PAGE_SIZE);
    }

    private Correction findCorrection(UUID tenant, UUID id, UUID note) {
        List<Correction> entries = jdbc.query("""
            SELECT id,observation_id,author_id,content,created_at,
                   acknowledged_at,acknowledged_by
            FROM nursing_observation_addenda
            WHERE tenant_id=:tenant AND observation_id=:observation AND id=:id
            """, Map.of("tenant", tenant, "observation", note, "id", id),
            (rs, row) -> mapCorrection(rs));
        if (entries.isEmpty()) notFound();
        return entries.getFirst();
    }

    private static Correction mapCorrection(ResultSet rs) throws SQLException {
        return new Correction(rs.getObject("id", UUID.class),
            rs.getObject("observation_id", UUID.class),
            rs.getObject("author_id", UUID.class),
            rs.getString("content"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("acknowledged_at", OffsetDateTime.class),
            rs.getObject("acknowledged_by", UUID.class));
    }

    private static HistoryItem historyItem(ResultSet rs) throws SQLException {
        return new HistoryItem(rs.getObject("observation_id", UUID.class),
            rs.getObject("appointment_id", UUID.class), rs.getString("patient_name"),
            rs.getString("unit_name"), rs.getString("service_name"),
            rs.getObject("starts_at", LocalDateTime.class), rs.getString("status"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("submitted_at", OffsetDateTime.class),
            rs.getObject("acknowledged_at", OffsetDateTime.class),
            rs.getLong("correction_count"));
    }

    private static String sha256(String content) {
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256")
                    .digest(content.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static void checkPage(int page) {
        if (page < 0 || page > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_PAGE");
        }
    }

    private static void notFound() {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND,
            "NURSING_OBSERVATION_NOT_AVAILABLE");
    }

    public record CorrectionInput(@NotBlank @Size(max=3000) String content) {}
    public record Correction(UUID id, UUID observationId, UUID authorId, String content,
                             OffsetDateTime createdAt, OffsetDateTime acknowledgedAt,
                             UUID acknowledgedBy) {}
    public record CorrectionPage(List<Correction> items, long total, int page, int size) {}
    public record HistoryItem(UUID observationId, UUID appointmentId,
                              String patientName, String unitName, String serviceName,
                              LocalDateTime startsAt, String status,
                              OffsetDateTime createdAt, OffsetDateTime submittedAt,
                              OffsetDateTime acknowledgedAt, long correctionCount) {}
    public record HistoryPage(List<HistoryItem> items, long total, int page, int size) {}
    private record Note(UUID id, UUID appointmentId, UUID authorId, String status) {}
    private record CorrectionFingerprint(UUID id, String hash) {}
}
