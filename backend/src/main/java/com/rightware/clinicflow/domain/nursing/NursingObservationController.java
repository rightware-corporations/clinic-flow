package com.rightware.clinicflow.domain.nursing;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
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
 * CF-N02A: nurse-authored observations and practitioner receipt.
 * This controller records observations only; it does not calculate acuity,
 * diagnosis, clinical advice, prescriptions or treatment decisions.
 */
@RestController
@RequestMapping("/api/v1")
public class NursingObservationController {
    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenants;
    private final AuditWriter audit;

    public NursingObservationController(NamedParameterJdbcTemplate jdbc,
                                        TenantAccessService tenants,
                                        AuditWriter audit) {
        this.jdbc = jdbc;
        this.tenants = tenants;
        this.audit = audit;
    }

    @PostMapping("/nursing/observations")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ObservationView create(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @Valid @RequestBody ObservationCreateInput input,
        Authentication auth) {
        var nurse = requireNurse(auth, tenant);
        AppointmentScope scope = requireNurseAppointmentScope(
            tenant, nurse.userId(), input.appointmentId(), true, false);

        Integer existing = jdbc.queryForObject("""
            SELECT count(*) FROM nursing_observations
            WHERE tenant_id=:tenant AND appointment_id=:appointment
            """, Map.of("tenant", tenant, "appointment", input.appointmentId()), Integer.class);
        if (existing != null && existing > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "NURSING_OBSERVATION_ALREADY_EXISTS");
        }
        validateMeasurementTimestamp(input.measurements(), input.measuredAt());

        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO nursing_observations(
              tenant_id,id,appointment_id,author_id,presenting_concern,observation_notes,
              temperature_c,heart_rate,respiratory_rate,spo2_percent,
              systolic_mmhg,diastolic_mmhg,measured_at)
            VALUES(
              :tenant,:id,:appointment,:author,:concern,:notes,
              :temperature,:heartRate,:respiratoryRate,:spo2,
              :systolic,:diastolic,:measuredAt)
            """, observationParams(tenant, id, input.appointmentId(), nurse.userId(),
                input.presentingConcern(), input.observationNotes(), input.measurements(),
                input.measuredAt()));
        event(tenant, id, nurse.userId(), "CREATE", 0);
        audit.write(tenant, nurse.userId(), "NURSING_OBSERVATION_CREATED",
            "NursingObservation", id);
        return findNurseOwn(tenant, input.appointmentId(), nurse.userId(), scope.unitId());
    }

    @GetMapping("/nursing/observations/{appointmentId}")
    @Transactional
    public ObservationView getOwn(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID appointmentId,
        Authentication auth) {
        var nurse = requireNurse(auth, tenant);
        AppointmentScope scope = requireNurseAppointmentScope(
            tenant, nurse.userId(), appointmentId, false, true);
        ObservationView result = findNurseOwn(
            tenant, appointmentId, nurse.userId(), scope.unitId());
        audit.write(tenant, nurse.userId(), "NURSING_OBSERVATION_READ",
            "NursingObservation", result.id());
        return result;
    }

    @PutMapping("/nursing/observations/{appointmentId}")
    @Transactional
    public ObservationView update(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID appointmentId,
        @Valid @RequestBody ObservationUpdateInput input,
        Authentication auth) {
        var nurse = requireNurse(auth, tenant);
        AppointmentScope scope = requireNurseAppointmentScope(
            tenant, nurse.userId(), appointmentId, false, false);
        validateMeasurementTimestamp(input.measurements(), input.measuredAt());

        ObservationView before = findNurseOwn(
            tenant, appointmentId, nurse.userId(), scope.unitId());
        if (!"DRAFT".equals(before.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "NURSING_OBSERVATION_ALREADY_SUBMITTED");
        }
        if (before.version() != input.version()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "STALE_NURSING_OBSERVATION_VERSION");
        }

        int changed = jdbc.update("""
            UPDATE nursing_observations SET
              presenting_concern=:concern,observation_notes=:notes,
              temperature_c=:temperature,heart_rate=:heartRate,
              respiratory_rate=:respiratoryRate,spo2_percent=:spo2,
              systolic_mmhg=:systolic,diastolic_mmhg=:diastolic,
              measured_at=:measuredAt,version=version+1,updated_at=now()
            WHERE tenant_id=:tenant AND appointment_id=:appointment
              AND author_id=:author AND status='DRAFT' AND version=:version
            """, observationParams(tenant, before.id(), appointmentId, nurse.userId(),
                input.presentingConcern(), input.observationNotes(), input.measurements(),
                input.measuredAt()).addValue("version", input.version()));
        if (changed == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "STALE_NURSING_OBSERVATION_VERSION");
        }
        event(tenant, before.id(), nurse.userId(), "EDIT_DRAFT", input.version() + 1);
        audit.write(tenant, nurse.userId(), "NURSING_OBSERVATION_DRAFT_UPDATED",
            "NursingObservation", before.id());
        return findNurseOwn(tenant, appointmentId, nurse.userId(), scope.unitId());
    }

    @PostMapping("/nursing/observations/{appointmentId}/submit")
    @Transactional
    public ObservationView submit(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID appointmentId,
        @Valid @RequestBody VersionInput input,
        Authentication auth) {
        var nurse = requireNurse(auth, tenant);
        AppointmentScope scope = requireNurseAppointmentScope(
            tenant, nurse.userId(), appointmentId, false, false);
        ObservationView before = findNurseOwn(
            tenant, appointmentId, nurse.userId(), scope.unitId());

        if (!"DRAFT".equals(before.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "NURSING_OBSERVATION_ALREADY_SUBMITTED");
        }
        if (before.version() != input.version()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "STALE_NURSING_OBSERVATION_VERSION");
        }
        if (!hasSubstantiveContent(before)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "NURSING_OBSERVATION_CONTENT_REQUIRED");
        }

        int changed = jdbc.update("""
            UPDATE nursing_observations
            SET status='SUBMITTED',submitted_at=now(),version=version+1,updated_at=now()
            WHERE tenant_id=:tenant AND appointment_id=:appointment
              AND author_id=:author AND status='DRAFT' AND version=:version
            """, Map.of("tenant", tenant, "appointment", appointmentId,
                "author", nurse.userId(), "version", input.version()));
        if (changed == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "STALE_NURSING_OBSERVATION_VERSION");
        }
        event(tenant, before.id(), nurse.userId(), "SUBMIT", input.version() + 1);
        audit.write(tenant, nurse.userId(), "NURSING_OBSERVATION_SUBMITTED",
            "NursingObservation", before.id());
        return findNurseOwn(tenant, appointmentId, nurse.userId(), scope.unitId());
    }

    @GetMapping("/practitioner/nursing-observations/{appointmentId}")
    @Transactional
    public ObservationView practitionerRead(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID appointmentId,
        Authentication auth) {
        var practitioner = requirePractitioner(auth, tenant);
        ObservationView result = findPractitionerVisible(
            tenant, appointmentId, practitioner.userId());
        audit.write(tenant, practitioner.userId(), "NURSING_OBSERVATION_PRACTITIONER_READ",
            "NursingObservation", result.id());
        return result;
    }

    @PostMapping("/practitioner/nursing-observations/{appointmentId}/acknowledge")
    @Transactional
    public ObservationView acknowledge(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID appointmentId,
        Authentication auth) {
        var practitioner = requirePractitioner(auth, tenant);
        ObservationView before = findPractitionerVisible(
            tenant, appointmentId, practitioner.userId());
        if ("ACKNOWLEDGED".equals(before.status())) {
            return before;
        }
        jdbc.queryForList("""
            SELECT id FROM nursing_observations
            WHERE tenant_id=:tenant AND appointment_id=:appointment FOR UPDATE
            """, Map.of("tenant", tenant, "appointment", appointmentId), UUID.class);

        int changed = jdbc.update("""
            UPDATE nursing_observations
            SET status='ACKNOWLEDGED',acknowledged_at=now(),
              acknowledged_by=:practitioner,version=version+1,updated_at=now()
            WHERE tenant_id=:tenant AND appointment_id=:appointment
              AND status='SUBMITTED' AND version=:version
            """, Map.of("tenant", tenant, "appointment", appointmentId,
                "practitioner", practitioner.userId(), "version", before.version()));
        if (changed == 0) {
            ObservationView current = findPractitionerVisible(
                tenant, appointmentId, practitioner.userId());
            if ("ACKNOWLEDGED".equals(current.status())) {
                return current;
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "STALE_NURSING_OBSERVATION_VERSION");
        }
        event(tenant, before.id(), practitioner.userId(), "ACKNOWLEDGE",
            before.version() + 1);
        audit.write(tenant, practitioner.userId(), "NURSING_OBSERVATION_ACKNOWLEDGED",
            "NursingObservation", before.id());
        return findPractitionerVisible(tenant, appointmentId, practitioner.userId());
    }

    private TenantAccessService.TenantAccess requireNurse(Authentication auth, UUID tenant) {
        var access = tenants.requireMembership(auth, tenant);
        if (!"NURSE".equals(access.role())) {
            throw new AccessDeniedException("Nurse role required");
        }
        Integer profile = jdbc.queryForObject("""
            SELECT count(*) FROM nursing_profiles
            WHERE tenant_id=:tenant AND user_id=:user
            """, Map.of("tenant", tenant, "user", access.userId()), Integer.class);
        if (profile == null || profile == 0) {
            throw new AccessDeniedException("Nursing profile required");
        }
        return access;
    }

    private TenantAccessService.TenantAccess requirePractitioner(Authentication auth, UUID tenant) {
        var access = tenants.requireMembership(auth, tenant);
        if (!"PRACTITIONER".equals(access.role())) {
            throw new AccessDeniedException("Practitioner role required");
        }
        Integer profile = jdbc.queryForObject("""
            SELECT count(*) FROM practitioner_profiles
            WHERE tenant_id=:tenant AND user_id=:user AND active
            """, Map.of("tenant", tenant, "user", access.userId()), Integer.class);
        if (profile == null || profile == 0) {
            throw new AccessDeniedException("Active practitioner profile required");
        }
        return access;
    }

    /**
     * Rechecks authorization against live membership, active unit assignment and
     * appointment state on every nurse read/write. A revoked unit grant fails closed.
     */
    private AppointmentScope requireNurseAppointmentScope(
        UUID tenant, UUID nurse, UUID appointment, boolean requireCheckIn, boolean allowCompleted) {
        List<AppointmentScope> rows = jdbc.query("""
            SELECT a.unit_id,a.practitioner_user_id
            FROM appointments a
            JOIN clinic_units cu
              ON cu.tenant_id=a.tenant_id AND cu.id=a.unit_id AND cu.active
            JOIN nursing_unit_assignments nu
              ON nu.tenant_id=a.tenant_id AND nu.unit_id=a.unit_id
              AND nu.nurse_user_id=:nurse
            JOIN patients p
              ON p.tenant_id=a.tenant_id AND p.id=a.patient_id
            WHERE a.tenant_id=:tenant AND a.id=:appointment
              AND (a.status IN ('CONFIRMED','IN_PROGRESS') OR (:allowCompleted = true AND a.status = 'COMPLETED'))
              AND p.archived_at IS NULL
              AND (:requireCheckIn=false OR EXISTS (
                SELECT 1 FROM reception_checkins rc
                WHERE rc.tenant_id=a.tenant_id AND rc.appointment_id=a.id))
            """, new MapSqlParameterSource()
                .addValue("tenant", tenant).addValue("appointment", appointment)
                .addValue("nurse", nurse).addValue("requireCheckIn", requireCheckIn)
                .addValue("allowCompleted", allowCompleted),
            (rs, row) -> new AppointmentScope(
                rs.getObject("unit_id", UUID.class),
                rs.getObject("practitioner_user_id", UUID.class)));
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                "NURSING_APPOINTMENT_NOT_AVAILABLE");
        }
        return rows.getFirst();
    }

    private ObservationView findNurseOwn(
        UUID tenant, UUID appointment, UUID author, UUID unitId) {
        List<ObservationView> rows = jdbc.query("""
            SELECT no.* FROM nursing_observations no
            JOIN appointments a
              ON a.tenant_id=no.tenant_id AND a.id=no.appointment_id
            JOIN nursing_unit_assignments nu
              ON nu.tenant_id=a.tenant_id AND nu.unit_id=a.unit_id
              AND nu.nurse_user_id=:author
            JOIN clinic_units cu
              ON cu.tenant_id=a.tenant_id AND cu.id=a.unit_id AND cu.active
            WHERE no.tenant_id=:tenant AND no.appointment_id=:appointment
              AND no.author_id=:author AND a.unit_id=:unit
            """, Map.of("tenant", tenant, "appointment", appointment,
                "author", author, "unit", unitId), (rs, row) -> mapObservation(rs));
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                "NURSING_OBSERVATION_NOT_FOUND");
        }
        return rows.getFirst();
    }

    private ObservationView findPractitionerVisible(
        UUID tenant, UUID appointment, UUID practitioner) {
        List<ObservationView> rows = jdbc.query("""
            SELECT no.* FROM nursing_observations no
            JOIN appointments a
              ON a.tenant_id=no.tenant_id AND a.id=no.appointment_id
            WHERE no.tenant_id=:tenant AND no.appointment_id=:appointment
              AND a.practitioner_user_id=:practitioner
              AND no.status IN ('SUBMITTED','ACKNOWLEDGED')
            """, Map.of("tenant", tenant, "appointment", appointment,
                "practitioner", practitioner), (rs, row) -> mapObservation(rs));
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                "NURSING_OBSERVATION_NOT_FOUND");
        }
        return rows.getFirst();
    }

    private void event(UUID tenant, UUID observation, UUID actor, String action, long version) {
        jdbc.update("""
            INSERT INTO nursing_observation_events(
              tenant_id,id,observation_id,actor_id,action,observation_version)
            VALUES(:tenant,:id,:observation,:actor,:action,:version)
            """, Map.of("tenant", tenant, "id", UUID.randomUUID(),
                "observation", observation, "actor", actor,
                "action", action, "version", version));
    }

    private static MapSqlParameterSource observationParams(
        UUID tenant, UUID id, UUID appointment, UUID author,
        String concern, String notes, Measurements measurements, OffsetDateTime measuredAt) {
        Measurements m = measurements == null ? Measurements.empty() : measurements;
        return new MapSqlParameterSource()
            .addValue("tenant", tenant).addValue("id", id)
            .addValue("appointment", appointment).addValue("author", author)
            .addValue("concern", trim(concern)).addValue("notes", trim(notes))
            .addValue("temperature", m.temperatureC())
            .addValue("heartRate", m.heartRate())
            .addValue("respiratoryRate", m.respiratoryRate())
            .addValue("spo2", m.spo2Percent())
            .addValue("systolic", m.systolicMmhg())
            .addValue("diastolic", m.diastolicMmhg())
            .addValue("measuredAt", measuredAt);
    }

    private static void validateMeasurementTimestamp(Measurements m, OffsetDateTime measuredAt) {
        boolean has = m != null && m.hasAny();
        if (has != (measuredAt != null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "MEASUREMENT_TIMESTAMP_REQUIRED_WITH_VALUES");
        }
    }

    private static boolean hasSubstantiveContent(ObservationView value) {
        return !value.presentingConcern().isBlank()
            || !value.observationNotes().isBlank()
            || value.measurements().hasAny();
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private static ObservationView mapObservation(ResultSet rs) throws SQLException {
        Measurements measurements = new Measurements(
            rs.getBigDecimal("temperature_c"),
            (Integer) rs.getObject("heart_rate"),
            (Integer) rs.getObject("respiratory_rate"),
            (Integer) rs.getObject("spo2_percent"),
            (Integer) rs.getObject("systolic_mmhg"),
            (Integer) rs.getObject("diastolic_mmhg"));
        return new ObservationView(
            rs.getObject("id", UUID.class),
            rs.getObject("appointment_id", UUID.class),
            rs.getString("status"),
            rs.getString("presenting_concern"),
            rs.getString("observation_notes"),
            measurements,
            rs.getObject("measured_at", OffsetDateTime.class),
            rs.getLong("version"),
            rs.getObject("submitted_at", OffsetDateTime.class),
            rs.getObject("acknowledged_at", OffsetDateTime.class),
            rs.getObject("acknowledged_by", UUID.class),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class));
    }

    public record ObservationCreateInput(
        @NotNull UUID appointmentId,
        @Size(max=1000) String presentingConcern,
        @Size(max=3000) String observationNotes,
        @Valid Measurements measurements,
        OffsetDateTime measuredAt) {}

    public record ObservationUpdateInput(
        @Min(0) long version,
        @Size(max=1000) String presentingConcern,
        @Size(max=3000) String observationNotes,
        @Valid Measurements measurements,
        OffsetDateTime measuredAt) {}

    public record VersionInput(@Min(0) long version) {}

    public record Measurements(
        @DecimalMin("-100.00") @DecimalMax("100.00") BigDecimal temperatureC,
        @Min(0) @Max(1000) Integer heartRate,
        @Min(0) @Max(1000) Integer respiratoryRate,
        @Min(0) @Max(100) Integer spo2Percent,
        @Min(0) @Max(1000) Integer systolicMmhg,
        @Min(0) @Max(1000) Integer diastolicMmhg) {
        static Measurements empty() {
            return new Measurements(null, null, null, null, null, null);
        }
        boolean hasAny() {
            return temperatureC != null || heartRate != null || respiratoryRate != null
                || spo2Percent != null || systolicMmhg != null || diastolicMmhg != null;
        }
    }

    public record ObservationView(
        UUID id,
        UUID appointmentId,
        String status,
        String presentingConcern,
        String observationNotes,
        Measurements measurements,
        OffsetDateTime measuredAt,
        long version,
        OffsetDateTime submittedAt,
        OffsetDateTime acknowledgedAt,
        UUID acknowledgedBy,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {}

    private record AppointmentScope(UUID unitId, UUID practitionerUserId) {}
}
