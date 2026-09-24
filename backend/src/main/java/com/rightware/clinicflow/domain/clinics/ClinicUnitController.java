package com.rightware.clinicflow.domain.clinics;

import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import com.rightware.clinicflow.platform.audit.AuditWriter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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
@RequestMapping("/api/v1/clinic-units")
public class ClinicUnitController {
    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenancy;
    private final AuditWriter audit;

    public ClinicUnitController(NamedParameterJdbcTemplate jdbc, TenantAccessService tenancy,
                                AuditWriter audit) {
        this.jdbc = jdbc;
        this.tenancy = tenancy;
        this.audit = audit;
    }

    @GetMapping
    public List<ClinicUnit> list(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                 Authentication auth) {
        tenancy.requireMembership(auth, tenant);
        return jdbc.query("""
            SELECT id, name, address, active FROM clinic_units
            WHERE tenant_id = :tenant ORDER BY name
            """, Map.of("tenant", tenant), (rs, row) -> map(rs));
    }

    @GetMapping("/{id}")
    public ClinicUnit get(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                          @PathVariable UUID id, Authentication auth) {
        tenancy.requireMembership(auth, tenant);
        return find(tenant, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ClinicUnit create(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                             @Valid @RequestBody UpsertUnit input, Authentication auth) {
        var actor = tenancy.requireClinicAdmin(auth, tenant);
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO clinic_units (id, tenant_id, name, address)
            VALUES (:id, :tenant, :name, :address)
            """, args(tenant, id, input));
        audit.write(tenant, actor.userId(), "CLINIC_UNIT_CREATED", "ClinicUnit", id);
        return find(tenant, id);
    }

    @PutMapping("/{id}")
    @Transactional
    public ClinicUnit update(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                             @PathVariable UUID id, @Valid @RequestBody UpsertUnit input,
                             Authentication auth) {
        var actor = tenancy.requireClinicAdmin(auth, tenant);
        int updated = jdbc.update("""
            UPDATE clinic_units SET name = :name, address = :address
            WHERE id = :id AND tenant_id = :tenant AND active
            """, args(tenant, id, input));
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        audit.write(tenant, actor.userId(), "CLINIC_UNIT_UPDATED", "ClinicUnit", id);
        return find(tenant, id);
    }

    @PostMapping("/{id}/deactivate")
    @Transactional
    public ClinicUnit deactivate(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                 @PathVariable UUID id, Authentication auth) {
        var actor = tenancy.requireClinicAdmin(auth, tenant);
        var locked = jdbc.queryForList("""
            SELECT id FROM clinic_units
            WHERE tenant_id=:tenant AND id=:id AND active FOR UPDATE
            """, Map.of("tenant",tenant,"id",id), UUID.class);
        if (locked.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"ACTIVE_CLINIC_UNIT_NOT_FOUND");
        }
        Integer booked = jdbc.queryForObject("""
            SELECT count(*) FROM appointments
            WHERE tenant_id=:tenant AND unit_id=:id
              AND status IN ('REQUESTED','CONFIRMED','IN_PROGRESS')
            """,Map.of("tenant",tenant,"id",id),Integer.class);
        if (booked!=null && booked>0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,"CLINIC_UNIT_HAS_ACTIVE_APPOINTMENTS");
        }
        Integer assigned = jdbc.queryForObject("""
            SELECT count(*) FROM practitioner_units pu
            JOIN practitioner_profiles pp ON pp.tenant_id=pu.tenant_id
                AND pp.user_id=pu.practitioner_user_id
            WHERE pu.tenant_id=:tenant AND pu.unit_id=:id AND pp.active
            """, Map.of("tenant", tenant, "id", id), Integer.class);
        if (assigned != null && assigned > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "CLINIC_UNIT_IN_USE");
        }
        // Once appointments exist, block deactivation when future appointments are pending.
        int updated = jdbc.update("""
            UPDATE clinic_units SET active = false
            WHERE id = :id AND tenant_id = :tenant AND active
            """, Map.of("id", id, "tenant", tenant));
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        audit.write(tenant, actor.userId(), "CLINIC_UNIT_DEACTIVATED", "ClinicUnit", id);
        return find(tenant, id);
    }

    @PostMapping("/{id}/reactivate")
    @Transactional
    public ClinicUnit reactivate(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                 @PathVariable UUID id,Authentication auth){
        var actor=tenancy.requireClinicAdmin(auth,tenant);
        int updated=jdbc.update("""
            UPDATE clinic_units SET active=true
            WHERE tenant_id=:tenant AND id=:id AND NOT active
            """,Map.of("tenant",tenant,"id",id));
        if(updated==0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"INACTIVE_CLINIC_UNIT_NOT_FOUND");
        }
        audit.write(tenant,actor.userId(),"CLINIC_UNIT_REACTIVATED","ClinicUnit",id);
        return find(tenant,id);
    }

    private ClinicUnit find(UUID tenant, UUID id) {
        return jdbc.query("""
            SELECT id, name, address, active FROM clinic_units
            WHERE id = :id AND tenant_id = :tenant
            """, Map.of("id", id, "tenant", tenant),
            (rs, row) -> map(rs)).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private static ClinicUnit map(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new ClinicUnit(rs.getObject("id", UUID.class), rs.getString("name"),
            rs.getString("address"), rs.getBoolean("active"));
    }

    private static MapSqlParameterSource args(UUID tenant, UUID id, UpsertUnit input) {
        return new MapSqlParameterSource().addValue("tenant", tenant).addValue("id", id)
            .addValue("name", input.name().trim()).addValue("address", input.address());
    }

    public record UpsertUnit(@NotBlank @Size(max=160) String name,
                             @Size(max=500) String address) {}
    public record ClinicUnit(UUID id, String name, String address, boolean active) {}
}
