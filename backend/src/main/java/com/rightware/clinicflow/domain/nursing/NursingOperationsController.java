package com.rightware.clinicflow.domain.nursing;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** CF-N01: operational visibility only. No clinical observations or report access. */
@RestController
@RequestMapping("/api/v1")
public class NursingOperationsController {
    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenants;
    private final AuditWriter audit;

    public NursingOperationsController(NamedParameterJdbcTemplate jdbc,
                                       TenantAccessService tenants, AuditWriter audit) {
        this.jdbc=jdbc; this.tenants=tenants; this.audit=audit;
    }

    @GetMapping("/admin/nursing-team")
    public List<NurseAssignment> team(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant, Authentication auth) {
        tenants.requireClinicAdmin(auth,tenant);
        var rows=jdbc.query("""
            SELECT u.id,u.display_name,u.email,np.version
            FROM tenant_memberships m
            JOIN users u ON u.id=m.user_id
            JOIN nursing_profiles np ON np.tenant_id=m.tenant_id AND np.user_id=m.user_id
            WHERE m.tenant_id=:tenant AND m.role='NURSE' AND m.active AND u.enabled
            ORDER BY u.display_name,u.id LIMIT 200
            """,Map.of("tenant",tenant),(rs,n)->new NurseRow(
                rs.getObject("id",UUID.class),rs.getString("display_name"),
                rs.getString("email"),rs.getLong("version")));
        return rows.stream().map(n->new NurseAssignment(n.id(),n.name(),n.email(),
            n.version(),assignedUnits(tenant,n.id()))).toList();
    }

    @PutMapping("/admin/nursing-team/{userId}/units")
    @Transactional
    public NurseAssignment assign(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID userId,
        @Valid @RequestBody UnitAssignmentInput input,
        Authentication auth) {
        var admin=tenants.requireClinicAdmin(auth,tenant);
        if(input.unitIds().size()!=new HashSet<>(input.unitIds()).size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"DUPLICATE_UNIT_ASSIGNMENT");
        }
        var nurse=jdbc.query("""
            SELECT np.version,u.display_name,u.email
            FROM nursing_profiles np
            JOIN tenant_memberships m ON m.tenant_id=np.tenant_id AND m.user_id=np.user_id
            JOIN users u ON u.id=np.user_id
            WHERE np.tenant_id=:tenant AND np.user_id=:nurse
              AND m.role='NURSE' AND m.active AND u.enabled
            FOR UPDATE OF np
            """,Map.of("tenant",tenant,"nurse",userId),
            (rs,n)->new NurseRow(userId,rs.getString("display_name"),
                rs.getString("email"),rs.getLong("version")));
        if(nurse.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"ACTIVE_NURSE_NOT_FOUND");
        var current=nurse.getFirst();
        if(current.version()!=input.version()){
            throw new ResponseStatusException(HttpStatus.CONFLICT,"STALE_NURSING_ASSIGNMENT");
        }
        if(!input.unitIds().isEmpty()) {
            var activeUnits=jdbc.queryForList("""
                SELECT id FROM clinic_units
                WHERE tenant_id=:tenant AND active AND id IN (:units)
                """,new MapSqlParameterSource().addValue("tenant",tenant)
                .addValue("units",input.unitIds()),UUID.class);
            if(activeUnits.size()!=input.unitIds().size()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"ACTIVE_TENANT_UNITS_REQUIRED");
            }
        }
        jdbc.update("""
            DELETE FROM nursing_unit_assignments WHERE tenant_id=:tenant AND nurse_user_id=:nurse
            """,Map.of("tenant",tenant,"nurse",userId));
        for(UUID unit:input.unitIds()) {
            jdbc.update("""
                INSERT INTO nursing_unit_assignments(tenant_id,nurse_user_id,unit_id)
                VALUES(:tenant,:nurse,:unit)
                """,Map.of("tenant",tenant,"nurse",userId,"unit",unit));
        }
        jdbc.update("""
            UPDATE nursing_profiles SET version=version+1
            WHERE tenant_id=:tenant AND user_id=:nurse
            """,Map.of("tenant",tenant,"nurse",userId));
        audit.write(tenant,admin.userId(),"NURSING_UNITS_UPDATED","NursingProfile",userId);
        return new NurseAssignment(userId,current.name(),current.email(),current.version()+1,
            assignedUnits(tenant,userId));
    }

    @GetMapping("/nursing/units")
    @Transactional
    public List<UnitView> myUnits(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant, Authentication auth) {
        var nurse=requireNurse(tenant,auth);
        var results=assignedUnits(tenant,nurse.userId());
        audit.write(tenant,nurse.userId(),"NURSING_UNITS_VIEWED","Organization",tenant);
        return results;
    }

    @GetMapping("/nursing/arrivals")
    @Transactional
    public List<ArrivalView> arrivals(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date,
        Authentication auth) {
        var nurse=requireNurse(tenant,auth);
        var results=jdbc.query("""
            SELECT a.id AS appointment_id,p.name AS patient_name,
              a.unit_id,cu.name AS unit_name,sd.name AS service_name,
              a.starts_at,a.status AS appointment_status,
              c.queue_status,c.arrived_at,c.called_at
            FROM nursing_unit_assignments nu
            JOIN clinic_units cu
              ON cu.tenant_id=nu.tenant_id AND cu.id=nu.unit_id AND cu.active
            JOIN appointments a
              ON a.tenant_id=nu.tenant_id AND a.unit_id=nu.unit_id
            JOIN reception_checkins c
              ON c.tenant_id=a.tenant_id AND c.appointment_id=a.id
            JOIN patients p
              ON p.tenant_id=a.tenant_id AND p.id=a.patient_id
            JOIN service_definitions sd
              ON sd.tenant_id=a.tenant_id AND sd.id=a.service_id
            WHERE nu.tenant_id=:tenant AND nu.nurse_user_id=:nurse
              AND a.starts_at>=:from AND a.starts_at<:to
              AND a.status IN ('CONFIRMED','IN_PROGRESS')
              AND p.archived_at IS NULL
            ORDER BY c.arrived_at,a.id LIMIT 500
            """,new MapSqlParameterSource().addValue("tenant",tenant)
                .addValue("nurse",nurse.userId())
                .addValue("from",date.atStartOfDay())
                .addValue("to",date.plusDays(1).atStartOfDay()),
            (rs,n)->mapArrival(rs));
        audit.write(tenant,nurse.userId(),"NURSING_ARRIVALS_VIEWED","Organization",tenant);
        return results;
    }

    private TenantAccessService.TenantAccess requireNurse(UUID tenant,Authentication auth) {
        var actor=tenants.requireMembership(auth,tenant);
        if(!"NURSE".equals(actor.role()))throw new AccessDeniedException("Nurse role required");
        return actor;
    }

    private List<UnitView> assignedUnits(UUID tenant,UUID nurse) {
        return jdbc.query("""
            SELECT cu.id,cu.name FROM nursing_unit_assignments nu
            JOIN clinic_units cu ON cu.tenant_id=nu.tenant_id AND cu.id=nu.unit_id
            WHERE nu.tenant_id=:tenant AND nu.nurse_user_id=:nurse AND cu.active
            ORDER BY cu.name,cu.id
            """,Map.of("tenant",tenant,"nurse",nurse),
            (rs,n)->new UnitView(rs.getObject("id",UUID.class),rs.getString("name")));
    }

    private static ArrivalView mapArrival(ResultSet rs)throws SQLException {
        return new ArrivalView(rs.getObject("appointment_id",UUID.class),
            rs.getString("patient_name"),rs.getObject("unit_id",UUID.class),
            rs.getString("unit_name"),rs.getString("service_name"),
            rs.getObject("starts_at",LocalDateTime.class),rs.getString("appointment_status"),
            rs.getString("queue_status"),rs.getObject("arrived_at",OffsetDateTime.class),
            rs.getObject("called_at",OffsetDateTime.class));
    }

    public record UnitView(UUID id,String name){}
    public record NurseAssignment(UUID userId,String displayName,String email,long version,
                                  List<UnitView> units){}
    public record UnitAssignmentInput(@NotNull @Min(0) Long version,
        @NotNull @Size(max=30) List<@NotNull UUID> unitIds){}
    public record ArrivalView(UUID appointmentId,String patientName,UUID unitId,String unitName,
        String serviceName,LocalDateTime startsAt,String appointmentStatus,
        String queueStatus,OffsetDateTime arrivedAt,OffsetDateTime calledAt){}
    private record NurseRow(UUID id,String name,String email,long version){}
}
