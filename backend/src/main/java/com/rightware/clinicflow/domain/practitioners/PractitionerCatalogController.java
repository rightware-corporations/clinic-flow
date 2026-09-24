package com.rightware.clinicflow.domain.practitioners;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
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

@RestController
@RequestMapping("/api/v1")
public class PractitionerCatalogController {
    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenants;
    private final AuditWriter audit;

    public PractitionerCatalogController(NamedParameterJdbcTemplate jdbc,
                                         TenantAccessService tenants,
                                         AuditWriter audit) {
        this.jdbc = jdbc;
        this.tenants = tenants;
        this.audit = audit;
    }

    @GetMapping("/specialties")
    public List<SpecialtyView> specialties(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                           Authentication auth) {
        tenants.requireMembership(auth, tenant);
        return jdbc.query("""
            SELECT id, name, code, active
            FROM specialties WHERE tenant_id = :tenant
            ORDER BY active DESC, name
            """, Map.of("tenant", tenant), (rs, row) ->
            new SpecialtyView(rs.getObject("id", UUID.class), rs.getString("name"),
                rs.getString("code"), rs.getBoolean("active")));
    }

    @PostMapping("/specialties")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public SpecialtyView createSpecialty(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                         @Valid @RequestBody SpecialtyInput input,
                                         Authentication auth) {
        var actor = tenants.requireClinicAdmin(auth, tenant);
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO specialties(id, tenant_id, name, code)
            VALUES(:id, :tenant, :name, :code)
            """, Map.of("id", id, "tenant", tenant,
                "name", input.name().trim(), "code", input.code().trim()));
        audit.write(tenant, actor.userId(), "SPECIALTY_CREATED", "Specialty", id);
        return specialty(tenant, id);
    }

    @PutMapping("/specialties/{id}")
    @Transactional
    public SpecialtyView updateSpecialty(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                         @PathVariable UUID id,
                                         @Valid @RequestBody SpecialtyInput input,
                                         Authentication auth) {
        var actor = tenants.requireClinicAdmin(auth, tenant);
        int changed = jdbc.update("""
            UPDATE specialties SET name=:name, code=:code
            WHERE tenant_id=:tenant AND id=:id AND active
            """, Map.of("tenant", tenant, "id", id,
                "name", input.name().trim(), "code", input.code().trim()));
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "SPECIALTY_NOT_FOUND");
        audit.write(tenant, actor.userId(), "SPECIALTY_UPDATED", "Specialty", id);
        return specialty(tenant, id);
    }

    @PostMapping("/specialties/{id}/deactivate")
    @Transactional
    public SpecialtyView deactivateSpecialty(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                             @PathVariable UUID id, Authentication auth) {
        var actor = tenants.requireClinicAdmin(auth, tenant);
        int changed = jdbc.update("""
            UPDATE specialties SET active=false
            WHERE tenant_id=:tenant AND id=:id AND active
            """, Map.of("tenant", tenant, "id", id));
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "SPECIALTY_NOT_FOUND");
        audit.write(tenant, actor.userId(), "SPECIALTY_DEACTIVATED", "Specialty", id);
        return specialty(tenant, id);
    }

    @GetMapping("/practitioners/eligible-members")
    public List<EligibleMemberView> eligibleMembers(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant, Authentication auth) {
        tenants.requireClinicAdmin(auth, tenant);
        return jdbc.query("""
            SELECT u.id, u.display_name, u.email, m.role
            FROM tenant_memberships m
            JOIN users u ON u.id=m.user_id
            LEFT JOIN practitioner_profiles p
              ON p.tenant_id=m.tenant_id AND p.user_id=m.user_id
            WHERE m.tenant_id=:tenant AND m.active AND u.enabled
              AND m.role IN ('PRACTITIONER','INTERN')
              AND p.user_id IS NULL
            ORDER BY u.display_name
            """, Map.of("tenant", tenant), (rs, row) ->
            new EligibleMemberView(rs.getObject("id", UUID.class),
                rs.getString("display_name"), rs.getString("email"),
                rs.getString("role")));
    }

    @GetMapping("/practitioners")
    public List<PractitionerView> practitioners(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                                Authentication auth) {
        tenants.requireMembership(auth, tenant);
        return jdbc.query("""
            SELECT p.user_id, u.display_name, u.email, p.specialty_id,
                   s.name AS specialty_name, p.professional_title, p.license_number,
                   p.bio, p.active, p.version
            FROM practitioner_profiles p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN specialties s ON s.tenant_id=p.tenant_id AND s.id=p.specialty_id
            WHERE p.tenant_id=:tenant
            ORDER BY p.active DESC, u.display_name
            """, Map.of("tenant", tenant), (rs, row) ->
            practitionerRow(tenant, rs));
    }

    @GetMapping("/practitioners/{userId}")
    public PractitionerView practitioner(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                         @PathVariable UUID userId,
                                         Authentication auth) {
        tenants.requireMembership(auth, tenant);
        return findPractitioner(tenant, userId);
    }

    @PostMapping("/practitioners")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public PractitionerView createPractitioner(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                               @Valid @RequestBody PractitionerInput input,
                                               Authentication auth) {
        var actor = tenants.requireClinicAdmin(auth, tenant);
        requireEligiblePractitionerMembership(tenant, input.userId());
        validateAssignments(tenant, input);
        jdbc.update("""
            INSERT INTO practitioner_profiles
                (tenant_id,user_id,specialty_id,professional_title,license_number,bio)
            VALUES(:tenant,:user,:specialty,:title,:license,:bio)
            """, profileArgs(tenant, input));
        replaceAssignments(tenant, input.userId(), input.unitIds(), input.serviceIds());
        audit.write(tenant, actor.userId(), "PRACTITIONER_CREATED", "Practitioner", input.userId());
        return findPractitioner(tenant, input.userId());
    }

    @PutMapping("/practitioners/{userId}")
    @Transactional
    public PractitionerView updatePractitioner(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                               @PathVariable UUID userId,
                                               @Valid @RequestBody PractitionerInput input,
                                               Authentication auth) {
        var actor = tenants.requireClinicAdmin(auth, tenant);
        if (!userId.equals(input.userId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "USER_ID_IMMUTABLE");
        }
        if (input.version() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "VERSION_REQUIRED");
        }
        validateAssignments(tenant, input);
        MapSqlParameterSource args = profileArgs(tenant, input).addValue("version", input.version());
        int changed = jdbc.update("""
            UPDATE practitioner_profiles
            SET specialty_id=:specialty, professional_title=:title,
                license_number=:license, bio=:bio, version=version+1, updated_at=now()
            WHERE tenant_id=:tenant AND user_id=:user AND active AND version=:version
            """, args);
        if (changed == 0) practitionerConflictOrMissing(tenant, userId);
        replaceAssignments(tenant, userId, input.unitIds(), input.serviceIds());
        audit.write(tenant, actor.userId(), "PRACTITIONER_UPDATED", "Practitioner", userId);
        return findPractitioner(tenant, userId);
    }

    @PostMapping("/practitioners/{userId}/deactivate")
    @Transactional
    public PractitionerView deactivatePractitioner(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                                   @PathVariable UUID userId,
                                                   @Valid @RequestBody VersionInput input,
                                                   Authentication auth) {
        var actor = tenants.requireClinicAdmin(auth, tenant);
        int changed = jdbc.update("""
            UPDATE practitioner_profiles
            SET active=false, version=version+1, updated_at=now()
            WHERE tenant_id=:tenant AND user_id=:user AND active AND version=:version
            """, Map.of("tenant", tenant, "user", userId, "version", input.version()));
        if (changed == 0) practitionerConflictOrMissing(tenant, userId);
        audit.write(tenant, actor.userId(), "PRACTITIONER_DEACTIVATED", "Practitioner", userId);
        return findPractitioner(tenant, userId);
    }

    private void requireEligiblePractitionerMembership(UUID tenant, UUID userId) {
        Integer count = jdbc.queryForObject("""
            SELECT count(*) FROM tenant_memberships
            WHERE tenant_id=:tenant AND user_id=:user AND active
              AND role IN ('PRACTITIONER','INTERN')
            """, Map.of("tenant", tenant, "user", userId), Integer.class);
        if (count == null || count == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PRACTITIONER_MEMBERSHIP_REQUIRED");
        }
    }

    private void validateAssignments(UUID tenant, PractitionerInput input) {
        if (input.specialtyId() != null && !exists("""
            SELECT count(*) FROM specialties
            WHERE tenant_id=:tenant AND id=:id AND active
            """, tenant, input.specialtyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_SPECIALTY");
        }
        for (UUID id : input.unitIds()) {
            if (!exists("""
                SELECT count(*) FROM clinic_units
                WHERE tenant_id=:tenant AND id=:id AND active
                """, tenant, id)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_CLINIC_UNIT");
            }
        }
        for (UUID id : input.serviceIds()) {
            if (!exists("""
                SELECT count(*) FROM service_definitions
                WHERE tenant_id=:tenant AND id=:id AND active
                """, tenant, id)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_SERVICE");
            }
        }
    }

    private boolean exists(String sql, UUID tenant, UUID id) {
        Integer count = jdbc.queryForObject(sql, Map.of("tenant", tenant, "id", id), Integer.class);
        return count != null && count > 0;
    }

    private void replaceAssignments(UUID tenant, UUID userId, List<UUID> units, List<UUID> services) {
        jdbc.update("DELETE FROM practitioner_units WHERE tenant_id=:tenant AND practitioner_user_id=:user",
            Map.of("tenant", tenant, "user", userId));
        jdbc.update("DELETE FROM practitioner_services WHERE tenant_id=:tenant AND practitioner_user_id=:user",
            Map.of("tenant", tenant, "user", userId));
        for (UUID unit : units) {
            jdbc.update("""
                INSERT INTO practitioner_units(tenant_id,practitioner_user_id,unit_id)
                VALUES(:tenant,:user,:id)
                """, Map.of("tenant", tenant, "user", userId, "id", unit));
        }
        for (UUID service : services) {
            jdbc.update("""
                INSERT INTO practitioner_services(tenant_id,practitioner_user_id,service_id)
                VALUES(:tenant,:user,:id)
                """, Map.of("tenant", tenant, "user", userId, "id", service));
        }
    }

    private SpecialtyView specialty(UUID tenant, UUID id) {
        return jdbc.query("""
            SELECT id,name,code,active FROM specialties
            WHERE tenant_id=:tenant AND id=:id
            """, Map.of("tenant", tenant, "id", id), (rs, row) ->
            new SpecialtyView(rs.getObject("id", UUID.class), rs.getString("name"),
                rs.getString("code"), rs.getBoolean("active")))
            .stream().findFirst().orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "SPECIALTY_NOT_FOUND"));
    }

    private PractitionerView findPractitioner(UUID tenant, UUID userId) {
        return jdbc.query("""
            SELECT p.user_id, u.display_name, u.email, p.specialty_id,
                   s.name AS specialty_name, p.professional_title, p.license_number,
                   p.bio, p.active, p.version
            FROM practitioner_profiles p
            JOIN users u ON u.id=p.user_id
            LEFT JOIN specialties s ON s.tenant_id=p.tenant_id AND s.id=p.specialty_id
            WHERE p.tenant_id=:tenant AND p.user_id=:user
            """, Map.of("tenant", tenant, "user", userId), (rs, row) ->
            practitionerRow(tenant, rs))
            .stream().findFirst().orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "PRACTITIONER_NOT_FOUND"));
    }

    private PractitionerView practitionerRow(UUID tenant, java.sql.ResultSet rs)
        throws java.sql.SQLException {
        UUID userId = rs.getObject("user_id", UUID.class);
        List<UUID> units = jdbc.queryForList("""
            SELECT unit_id FROM practitioner_units
            WHERE tenant_id=:tenant AND practitioner_user_id=:user ORDER BY unit_id
            """, Map.of("tenant", tenant, "user", userId), UUID.class);
        List<UUID> services = jdbc.queryForList("""
            SELECT service_id FROM practitioner_services
            WHERE tenant_id=:tenant AND practitioner_user_id=:user ORDER BY service_id
            """, Map.of("tenant", tenant, "user", userId), UUID.class);
        return new PractitionerView(userId, rs.getString("display_name"),
            rs.getString("email"), rs.getObject("specialty_id", UUID.class),
            rs.getString("specialty_name"), rs.getString("professional_title"),
            rs.getString("license_number"), rs.getString("bio"), units, services,
            rs.getBoolean("active"), rs.getLong("version"));
    }

    private void practitionerConflictOrMissing(UUID tenant, UUID userId) {
        Integer count = jdbc.queryForObject("""
            SELECT count(*) FROM practitioner_profiles
            WHERE tenant_id=:tenant AND user_id=:user AND active
            """, Map.of("tenant", tenant, "user", userId), Integer.class);
        throw new ResponseStatusException(count != null && count > 0
            ? HttpStatus.CONFLICT : HttpStatus.NOT_FOUND,
            count != null && count > 0 ? "STALE_PRACTITIONER_VERSION" : "PRACTITIONER_NOT_FOUND");
    }

    private static MapSqlParameterSource profileArgs(UUID tenant, PractitionerInput input) {
        return new MapSqlParameterSource()
            .addValue("tenant", tenant).addValue("user", input.userId())
            .addValue("specialty", input.specialtyId())
            .addValue("title", optional(input.professionalTitle()))
            .addValue("license", optional(input.licenseNumber()))
            .addValue("bio", optional(input.bio()));
    }

    private static String optional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record SpecialtyInput(
        @NotBlank @Size(max=160) String name,
        @NotBlank @Size(max=80)
        @Pattern(regexp="^[a-z0-9]+(?:-[a-z0-9]+)*$") String code) {}
    public record SpecialtyView(UUID id, String name, String code, boolean active) {}
    public record EligibleMemberView(UUID userId, String displayName, String email, String role) {}
    public record VersionInput(@NotNull @Min(0) Long version) {}
    public record PractitionerInput(
        @NotNull UUID userId,
        UUID specialtyId,
        @Size(max=120) String professionalTitle,
        @Size(max=120) String licenseNumber,
        @Size(max=1000) String bio,
        @NotNull List<UUID> unitIds,
        @NotNull List<UUID> serviceIds,
        @Min(0) Long version) {}
    public record PractitionerView(
        UUID userId, String displayName, String email,
        UUID specialtyId, String specialtyName,
        String professionalTitle, String licenseNumber, String bio,
        List<UUID> unitIds, List<UUID> serviceIds,
        boolean active, long version) {}
}
