package com.rightware.clinicflow.domain.patients;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Tenant-scoped demographic registry. Clinical records and practitioner care relationships
 * are intentionally excluded from this slice.
 */
@RestController
@RequestMapping("/api/v1/patients")
public class PatientController {
    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenants;
    private final AuditWriter audit;

    public PatientController(NamedParameterJdbcTemplate jdbc,
                             TenantAccessService tenants, AuditWriter audit) {
        this.jdbc = jdbc;
        this.tenants = tenants;
        this.audit = audit;
    }

    @GetMapping
    @Transactional
    public PatientPage list(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @RequestParam(defaultValue = "") @Size(max = 80) String query,
        @RequestParam(defaultValue = "0") @Min(0) @Max(10000) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
        Authentication authentication) {
        var actor = tenants.requirePatientRegistryAccess(authentication, tenant);
        String search = query.trim();
        MapSqlParameterSource args = new MapSqlParameterSource()
            .addValue("tenant", tenant).addValue("query", search)
            .addValue("limit", size).addValue("offset", (long) page * size);
        String filter = """
            tenant_id = :tenant AND archived_at IS NULL
            AND (:query = '' OR name ILIKE '%' || :query || '%'
                OR phone ILIKE '%' || :query || '%'
                OR health_number ILIKE '%' || :query || '%')
            """;
        Long total = jdbc.queryForObject("SELECT count(*) FROM patients WHERE " + filter,
            args, Long.class);
        List<PatientView> items = jdbc.query("""
            SELECT id, name, date_of_birth, gender, phone, email, address,
                   national_id, health_number, version, created_at, updated_at
            FROM patients WHERE
            """ + filter + " ORDER BY created_at DESC, id LIMIT :limit OFFSET :offset",
            args, (rs, index) -> fromRow(rs));
        // No search terms or personal data are recorded in the audit event.
        audit.write(tenant, actor.userId(), "PATIENT_REGISTRY_SEARCHED", "Organization", tenant);
        return new PatientPage(items, total == null ? 0 : total, page, size);
    }

    @GetMapping("/{id}")
    @Transactional
    public PatientView get(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                           @PathVariable UUID id, Authentication authentication) {
        var actor = tenants.requirePatientRegistryAccess(authentication, tenant);
        PatientView patient = find(tenant, id);
        audit.write(tenant, actor.userId(), "PATIENT_DEMOGRAPHICS_READ", "Patient", id);
        return patient;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public PatientView create(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                              @Valid @RequestBody PatientInput input,
                              Authentication authentication) {
        var actor = tenants.requirePatientRegistryAccess(authentication, tenant);
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO patients (id, tenant_id, name, date_of_birth, gender, phone,
                                  email, address, national_id, health_number)
            VALUES (:id, :tenant, :name, :dob, :gender, :phone,
                    :email, :address, :nationalId, :healthNumber)
            """, values(tenant, id, input));
        audit.write(tenant, actor.userId(), "PATIENT_CREATED", "Patient", id);
        return find(tenant, id);
    }

    @PutMapping("/{id}")
    @Transactional
    public PatientView update(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                              @PathVariable UUID id, @Valid @RequestBody PatientInput input,
                              Authentication authentication) {
        var actor = tenants.requirePatientRegistryAccess(authentication, tenant);
        if (input.version() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "VERSION_REQUIRED");
        }
        int updated = jdbc.update("""
            UPDATE patients SET name = :name, date_of_birth = :dob, gender = :gender,
                phone = :phone, email = :email, address = :address,
                national_id = :nationalId, health_number = :healthNumber,
                version = version + 1, updated_at = now()
            WHERE id = :id AND tenant_id = :tenant AND archived_at IS NULL
              AND version = :version
            """, values(tenant, id, input));
        if (updated == 0) notFoundOrConflict(tenant, id);
        audit.write(tenant, actor.userId(), "PATIENT_UPDATED", "Patient", id);
        return find(tenant, id);
    }

    @PostMapping("/{id}/archive")
    @Transactional
    public Map<String, Boolean> archive(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                        @PathVariable UUID id, @Valid @RequestBody ArchiveInput input,
                        Authentication authentication) {
        var actor = tenants.requireClinicAdmin(authentication, tenant);
        int changed = jdbc.update("""
            UPDATE patients SET archived_at = now(), archived_by = :actor,
                version = version + 1, updated_at = now()
            WHERE id = :id AND tenant_id = :tenant AND archived_at IS NULL
              AND version = :version
            """, Map.of("id", id, "tenant", tenant, "actor", actor.userId(),
                "version", input.version()));
        if (changed == 0) notFoundOrConflict(tenant, id);
        audit.write(tenant, actor.userId(), "PATIENT_ARCHIVED", "Patient", id);
        return Map.of("archived", true);
    }

    private void notFoundOrConflict(UUID tenant, UUID id) {
        Integer count = jdbc.queryForObject("""
            SELECT count(*) FROM patients
            WHERE id = :id AND tenant_id = :tenant AND archived_at IS NULL
            """, Map.of("id", id, "tenant", tenant), Integer.class);
        throw new ResponseStatusException(count != null && count > 0
            ? HttpStatus.CONFLICT : HttpStatus.NOT_FOUND,
            count != null && count > 0 ? "STALE_PATIENT_VERSION" : "PATIENT_NOT_FOUND");
    }

    private PatientView find(UUID tenant, UUID id) {
        return jdbc.query("""
            SELECT id, name, date_of_birth, gender, phone, email, address,
                   national_id, health_number, version, created_at, updated_at
            FROM patients WHERE tenant_id = :tenant AND id = :id
                AND archived_at IS NULL
            """, Map.of("tenant", tenant, "id", id), (rs, index) -> fromRow(rs))
            .stream().findFirst().orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "PATIENT_NOT_FOUND"));
    }

    private static PatientView fromRow(ResultSet rs) throws SQLException {
        return new PatientView(
            rs.getObject("id", UUID.class), rs.getString("name"),
            rs.getObject("date_of_birth", LocalDate.class), rs.getString("gender"),
            rs.getString("phone"), rs.getString("email"), rs.getString("address"),
            rs.getString("national_id"), rs.getString("health_number"),
            rs.getLong("version"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class));
    }

    private static MapSqlParameterSource values(UUID tenant, UUID id, PatientInput input) {
        return new MapSqlParameterSource()
            .addValue("tenant", tenant).addValue("id", id)
            .addValue("name", input.name().trim()).addValue("dob", input.dateOfBirth())
            .addValue("gender", input.gender()).addValue("phone", optional(input.phone()))
            .addValue("email", optional(input.email()) == null
                ? null : optional(input.email()).toLowerCase(java.util.Locale.ROOT))
            .addValue("address", optional(input.address()))
            .addValue("nationalId", optional(input.nationalId()))
            .addValue("healthNumber", optional(input.healthNumber()))
            .addValue("version", input.version());
    }

    private static String optional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PatientInput(
        @NotBlank @Size(max=160) String name,
        @NotNull @PastOrPresent LocalDate dateOfBirth,
        @NotBlank @Pattern(regexp="M|F|OTHER|NOT_DISCLOSED") String gender,
        @Size(max=40) String phone,
        @Email @Size(max=254) String email,
        @Size(max=500) String address,
        @Size(max=100) String nationalId,
        @Size(max=100) String healthNumber,
        @Min(0) Long version) {}

    public record ArchiveInput(@NotNull @Min(0) Long version) {}

    public record PatientView(UUID id, String name, LocalDate dateOfBirth,
        String gender, String phone, String email, String address,
        String nationalId, String healthNumber, long version,
        OffsetDateTime createdAt, OffsetDateTime updatedAt) {}

    public record PatientPage(List<PatientView> items, long total, int page, int size) {}
}
