package com.rightware.clinicflow.domain.catalog;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
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
@RequestMapping("/api/v1/services")
public class ServiceCatalogController {
    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenancy;
    private final AuditWriter audit;

    public ServiceCatalogController(NamedParameterJdbcTemplate jdbc,
                                    TenantAccessService tenancy, AuditWriter audit) {
        this.jdbc = jdbc;
        this.tenancy = tenancy;
        this.audit = audit;
    }

    @GetMapping
    public List<ServiceDefinition> list(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                        Authentication auth) {
        tenancy.requireMembership(auth, tenant);
        return jdbc.query("""
            SELECT id, name, slug, duration_minutes, price, currency_code, active
            FROM service_definitions WHERE tenant_id = :tenant ORDER BY name
            """, Map.of("tenant", tenant), (rs, row) -> map(rs));
    }

    @GetMapping("/{id}")
    public ServiceDefinition get(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                 @PathVariable UUID id, Authentication auth) {
        tenancy.requireMembership(auth, tenant);
        return find(tenant, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ServiceDefinition create(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                    @Valid @RequestBody ServiceInput input, Authentication auth) {
        var actor = tenancy.requireClinicAdmin(auth, tenant);
        validateMoney(input);
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO service_definitions
                (id, tenant_id, name, slug, duration_minutes, price, currency_code)
            VALUES (:id, :tenant, :name, :slug, :duration, :price, :currency)
            """, args(tenant, id, input));
        audit.write(tenant, actor.userId(), "SERVICE_CREATED", "ServiceDefinition", id);
        return find(tenant, id);
    }

    @PutMapping("/{id}")
    @Transactional
    public ServiceDefinition update(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                    @PathVariable UUID id, @Valid @RequestBody ServiceInput input,
                                    Authentication auth) {
        var actor = tenancy.requireClinicAdmin(auth, tenant);
        validateMoney(input);
        int updated = jdbc.update("""
            UPDATE service_definitions SET name = :name, slug = :slug,
                duration_minutes = :duration, price = :price, currency_code = :currency
            WHERE tenant_id = :tenant AND id = :id AND active
            """, args(tenant, id, input));
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        audit.write(tenant, actor.userId(), "SERVICE_UPDATED", "ServiceDefinition", id);
        return find(tenant, id);
    }

    @PostMapping("/{id}/deactivate")
    @Transactional
    public ServiceDefinition deactivate(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                        @PathVariable UUID id, Authentication auth) {
        var actor = tenancy.requireClinicAdmin(auth, tenant);
        Integer assigned = jdbc.queryForObject("""
            SELECT count(*) FROM practitioner_services ps
            JOIN practitioner_profiles pp ON pp.tenant_id=ps.tenant_id
                AND pp.user_id=ps.practitioner_user_id
            WHERE ps.tenant_id=:tenant AND ps.service_id=:id AND pp.active
            """, Map.of("tenant", tenant, "id", id), Integer.class);
        if (assigned != null && assigned > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SERVICE_IN_USE");
        }
        int updated = jdbc.update("""
            UPDATE service_definitions SET active = false
            WHERE tenant_id = :tenant AND id = :id AND active
            """, Map.of("tenant", tenant, "id", id));
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        audit.write(tenant, actor.userId(), "SERVICE_DEACTIVATED", "ServiceDefinition", id);
        return find(tenant, id);
    }

    private ServiceDefinition find(UUID tenant, UUID id) {
        return jdbc.query("""
            SELECT id, name, slug, duration_minutes, price, currency_code, active
            FROM service_definitions WHERE tenant_id = :tenant AND id = :id
            """, Map.of("tenant", tenant, "id", id), (rs, row) -> map(rs))
            .stream().findFirst().orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private static ServiceDefinition map(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new ServiceDefinition(rs.getObject("id", UUID.class), rs.getString("name"),
            rs.getString("slug"), rs.getInt("duration_minutes"),
            rs.getBigDecimal("price"), rs.getString("currency_code"), rs.getBoolean("active"));
    }

    private static MapSqlParameterSource args(UUID tenant, UUID id, ServiceInput input) {
        return new MapSqlParameterSource().addValue("tenant", tenant).addValue("id", id)
            .addValue("name", input.name().trim()).addValue("slug", input.slug())
            .addValue("duration", input.durationMinutes()).addValue("price", input.price())
            .addValue("currency", input.currencyCode());
    }

    private static void validateMoney(ServiceInput input) {
        if ((input.price() == null) != (input.currencyCode() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "PRICE_AND_CURRENCY_REQUIRED_TOGETHER");
        }
    }

    public record ServiceInput(
        @NotBlank @Size(max=160) String name,
        @NotBlank @Pattern(regexp="^[a-z0-9]+(?:-[a-z0-9]+)*$")
        @Size(max=180) String slug,
        @Min(5) @Max(480) int durationMinutes,
        @DecimalMin("0.00") @Digits(integer=10, fraction=2) BigDecimal price,
        @Pattern(regexp="^[A-Z]{3}$") String currencyCode) {}

    public record ServiceDefinition(UUID id, String name, String slug, int durationMinutes,
                                    BigDecimal price, String currencyCode, boolean active) {}
}
