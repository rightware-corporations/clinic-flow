package com.rightware.clinicflow.domain.reception;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
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

@RestController
@RequestMapping("/api/v1/reception")
public class ReceptionQueueController {
    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenants;
    private final AuditWriter audit;
    private static final String DETAILS = """
        SELECT c.id,c.appointment_id,c.arrived_at,c.queue_status,c.queue_version,
               c.called_at,a.status AS appointment_status,a.version AS appointment_version,
               a.starts_at,a.unit_id,p.name AS patient_name,
               u.display_name AS practitioner_name,cu.name AS unit_name,
               sd.name AS service_name
        FROM reception_checkins c
        JOIN appointments a ON a.tenant_id=c.tenant_id AND a.id=c.appointment_id
        JOIN patients p ON p.tenant_id=a.tenant_id AND p.id=a.patient_id
        JOIN users u ON u.id=a.practitioner_user_id
        JOIN clinic_units cu ON cu.tenant_id=a.tenant_id AND cu.id=a.unit_id
        JOIN service_definitions sd ON sd.tenant_id=a.tenant_id AND sd.id=a.service_id
        """;

    public ReceptionQueueController(NamedParameterJdbcTemplate jdbc,
                                    TenantAccessService tenants,AuditWriter audit) {
        this.jdbc=jdbc;this.tenants=tenants;this.audit=audit;
    }

    @GetMapping("/queue")
    @Transactional
    public List<QueueEntry> queue(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date,
        @RequestParam(required=false) UUID unitId, Authentication auth) {
        var actor=requireReception(auth,tenant);
        var args=new MapSqlParameterSource().addValue("tenant",tenant)
            .addValue("date",date);
        String unitFilter="";
        if(unitId!=null){args.addValue("unit",unitId);unitFilter=" AND a.unit_id=:unit";}
        var result=jdbc.query(DETAILS+
            " WHERE c.tenant_id=:tenant AND a.starts_at::date=:date"+
            unitFilter+" ORDER BY c.arrived_at,c.id LIMIT 1000",
            args,(rs,n)->row(rs));
        audit.write(tenant,actor.userId(),"RECEPTION_QUEUE_VIEWED","Organization",tenant);
        return result;
    }

    @PostMapping("/check-ins")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public QueueEntry checkIn(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                              @Valid @RequestBody CheckInInput input,Authentication auth) {
        var actor=requireReception(auth,tenant);
        var found=jdbc.query("""
            SELECT a.status,a.version,a.starts_at,o.time_zone
            FROM appointments a JOIN organizations o ON o.id=a.tenant_id
            WHERE a.tenant_id=:tenant AND a.id=:id FOR UPDATE OF a
            """,Map.of("tenant",tenant,"id",input.appointmentId()),
            (rs,n)->new AppointmentState(rs.getString("status"),rs.getLong("version"),
                rs.getObject("starts_at",LocalDateTime.class),rs.getString("time_zone")));
        if(found.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"APPOINTMENT_NOT_FOUND");
        var existing=byAppointment(tenant,input.appointmentId());
        if(!existing.isEmpty())return existing.getFirst();
        var appointment=found.getFirst();
        if(!appointment.status().equals("CONFIRMED"))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"CHECK_IN_REQUIRES_CONFIRMED");
        if(appointment.version()!=input.appointmentVersion())
            throw new ResponseStatusException(HttpStatus.CONFLICT,"STALE_APPOINTMENT_VERSION");
        LocalDate today;
        try {today=LocalDate.now(ZoneId.of(appointment.timeZone()));}
        catch(DateTimeException e){
            throw new ResponseStatusException(HttpStatus.CONFLICT,"CLINIC_TIMEZONE_INVALID");
        }
        if(!appointment.startsAt().toLocalDate().equals(today))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"CHECK_IN_DATE_MISMATCH");
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO reception_checkins(tenant_id,id,appointment_id,checked_in_by)
            VALUES(:tenant,:id,:appointment,:actor)
            """,Map.of("tenant",tenant,"id",id,"appointment",input.appointmentId(),
                "actor",actor.userId()));
        event(tenant,id,actor.userId(),"CHECK_IN");
        audit.write(tenant,actor.userId(),"PATIENT_CHECKED_IN","Appointment",input.appointmentId());
        return find(tenant,id);
    }

    @PostMapping("/queue/{id}/call")
    @Transactional
    public QueueEntry call(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID id,@Valid @RequestBody VersionInput input,Authentication auth) {
        var actor=requireReception(auth,tenant);
        var appointment=jdbc.queryForList("""
            SELECT appointment_id FROM reception_checkins WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",tenant,"id",id),UUID.class);
        if(appointment.isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"CHECK_IN_NOT_FOUND");
        var statuses=jdbc.queryForList("""
            SELECT status FROM appointments WHERE tenant_id=:tenant AND id=:id FOR UPDATE
            """,Map.of("tenant",tenant,"id",appointment.getFirst()),String.class);
        if(statuses.isEmpty()||!statuses.getFirst().equals("CONFIRMED"))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"APPOINTMENT_NOT_AWAITING_CARE");
        int updated=jdbc.update("""
            UPDATE reception_checkins SET queue_status='CALLED',
                queue_version=queue_version+1,called_at=now(),called_by=:actor
            WHERE tenant_id=:tenant AND id=:id AND queue_status='WAITING'
              AND queue_version=:version
            """,Map.of("tenant",tenant,"id",id,"actor",actor.userId(),
                "version",input.version()));
        if(updated==0)throw new ResponseStatusException(HttpStatus.CONFLICT,"STALE_QUEUE_VERSION");
        event(tenant,id,actor.userId(),"CALL");
        audit.write(tenant,actor.userId(),"PATIENT_CALLED","Appointment",appointment.getFirst());
        return find(tenant,id);
    }

    private TenantAccessService.TenantAccess requireReception(Authentication auth,UUID tenant) {
        var actor=tenants.requireMembership(auth,tenant);
        if(!Set.of("CLINIC_ADMIN","RECEPTION").contains(actor.role()))
            throw new AccessDeniedException("Reception-only access");
        return actor;
    }

    private List<QueueEntry> byAppointment(UUID tenant,UUID appointment) {
        return jdbc.query(DETAILS+" WHERE c.tenant_id=:tenant AND c.appointment_id=:id",
            Map.of("tenant",tenant,"id",appointment),(rs,n)->row(rs));
    }
    private QueueEntry find(UUID tenant,UUID id) {
        return jdbc.query(DETAILS+" WHERE c.tenant_id=:tenant AND c.id=:id",
            Map.of("tenant",tenant,"id",id),(rs,n)->row(rs)).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"CHECK_IN_NOT_FOUND"));
    }
    private void event(UUID tenant,UUID id,UUID actor,String action) {
        jdbc.update("""
            INSERT INTO reception_queue_events(tenant_id,id,checkin_id,actor_id,action)
            VALUES(:tenant,:id,:checkin,:actor,:action)
            """,Map.of("tenant",tenant,"id",UUID.randomUUID(),"checkin",id,
                "actor",actor,"action",action));
    }
    private static QueueEntry row(ResultSet rs)throws SQLException {
        return new QueueEntry(rs.getObject("id",UUID.class),
            rs.getObject("appointment_id",UUID.class),
            rs.getObject("arrived_at",OffsetDateTime.class),
            rs.getString("queue_status"),rs.getLong("queue_version"),
            rs.getObject("called_at",OffsetDateTime.class),
            rs.getString("appointment_status"),rs.getLong("appointment_version"),
            rs.getObject("starts_at",LocalDateTime.class),
            rs.getObject("unit_id",UUID.class),rs.getString("patient_name"),
            rs.getString("practitioner_name"),rs.getString("unit_name"),
            rs.getString("service_name"));
    }

    private record AppointmentState(String status,long version,LocalDateTime startsAt,
                                    String timeZone){}
    public record CheckInInput(@NotNull UUID appointmentId,
                               @NotNull @Min(0) Long appointmentVersion){}
    public record VersionInput(@NotNull @Min(0) Long version){}
    public record QueueEntry(UUID id,UUID appointmentId,OffsetDateTime arrivedAt,
        String queueStatus,long queueVersion,OffsetDateTime calledAt,
        String appointmentStatus,long appointmentVersion,LocalDateTime startsAt,
        UUID unitId,String patientName,String practitionerName,String unitName,
        String serviceName){}
}
