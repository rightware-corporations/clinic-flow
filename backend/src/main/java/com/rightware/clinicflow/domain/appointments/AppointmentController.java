package com.rightware.clinicflow.domain.appointments;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
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
@RequestMapping("/api/v1/appointments")
public class AppointmentController {
    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenants;
    private final AppointmentAvailabilityService availability;
    private final AuditWriter audit;

    public AppointmentController(NamedParameterJdbcTemplate jdbc,
                                 TenantAccessService tenants,
                                 AppointmentAvailabilityService availability,
                                 AuditWriter audit) {
        this.jdbc=jdbc;
        this.tenants=tenants;
        this.availability=availability;
        this.audit=audit;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AppointmentView create(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @RequestHeader("Idempotency-Key") UUID idempotencyKey,
        @Valid @RequestBody CreateAppointment input,
        Authentication auth) {
        var actor=requireReception(auth,tenant);
        String hash=fingerprint(input);
        List<ExistingRequest> prior=jdbc.query("""
            SELECT id,request_hash FROM appointments
            WHERE tenant_id=:tenant AND created_by=:actor AND idempotency_key=:key
            """,Map.of("tenant",tenant,"actor",actor.userId(),"key",idempotencyKey),
            (rs,row)->new ExistingRequest(rs.getObject("id",UUID.class),
                rs.getString("request_hash").trim()));
        if(!prior.isEmpty()){
            if(!prior.getFirst().hash().equals(hash)){
                throw new ResponseStatusException(HttpStatus.CONFLICT,"IDEMPOTENCY_KEY_REUSED");
            }
            return find(tenant,prior.getFirst().id());
        }

        LocalDateTime end=availability.requireSlot(tenant,input.patientId(),
            input.practitionerUserId(),input.unitId(),input.serviceId(),input.startsAt());
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO appointments
                (id,tenant_id,patient_id,practitioner_user_id,unit_id,service_id,
                 starts_at,ends_at,status,created_by,idempotency_key,request_hash)
            VALUES(:id,:tenant,:patient,:professional,:unit,:service,
                   :start,:end,'REQUESTED',:actor,:key,:hash)
            """,new MapSqlParameterSource()
                .addValue("id",id).addValue("tenant",tenant)
                .addValue("patient",input.patientId())
                .addValue("professional",input.practitionerUserId())
                .addValue("unit",input.unitId()).addValue("service",input.serviceId())
                .addValue("start",input.startsAt()).addValue("end",end)
                .addValue("actor",actor.userId()).addValue("key",idempotencyKey)
                .addValue("hash",hash));
        event(tenant,id,actor.userId(),"CREATE",null,"REQUESTED",
            null,input.startsAt());
        audit.write(tenant,actor.userId(),"APPOINTMENT_CREATED","Appointment",id);
        return find(tenant,id);
    }

    @GetMapping
    public List<AppointmentView> list(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(required=false) UUID practitionerUserId,
        Authentication auth) {
        var actor=tenants.requireMembership(auth,tenant);
        if(to.isBefore(from)||to.isAfter(from.plusDays(90))){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"INVALID_APPOINTMENT_RANGE");
        }
        if(!actor.role().equals("CLINIC_ADMIN") && !actor.role().equals("RECEPTION")
            && !actor.role().equals("PRACTITIONER")){
            throw new AccessDeniedException("Appointment calendar access denied");
        }
        UUID professional=practitionerUserId;
        if(actor.role().equals("PRACTITIONER")){
            if(professional!=null&&!professional.equals(actor.userId())){
                throw new AccessDeniedException("Only own appointments are visible");
            }
            professional=actor.userId();
        }
        MapSqlParameterSource params=new MapSqlParameterSource()
            .addValue("tenant",tenant).addValue("from",from.atStartOfDay())
            .addValue("to",to.plusDays(1).atStartOfDay());
        String sql="""
            SELECT id,patient_id,practitioner_user_id,unit_id,service_id,
                   starts_at,ends_at,status,version
            FROM appointments
            WHERE tenant_id=:tenant AND starts_at>=:from AND starts_at<:to
            """;
        if(professional!=null){
            params.addValue("professional",professional);
            sql+=" AND practitioner_user_id=:professional";
        }
        sql+=" ORDER BY starts_at,id LIMIT 1000";
        return jdbc.query(sql,params,(rs,row)->row(rs));
    }

    @GetMapping("/{id}")
    public AppointmentView get(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                               @PathVariable UUID id,Authentication auth){
        var actor=tenants.requireMembership(auth,tenant);
        var existing=find(tenant,id);
        requireCalendarAccess(actor,existing);
        return existing;
    }

    @PostMapping("/{id}/confirm")
    @Transactional
    public AppointmentView confirm(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID id,@Valid @RequestBody VersionInput input,Authentication auth){
        return transition(tenant,id,input.version(),auth,"CONFIRM","CONFIRMED",
            Set.of("REQUESTED"),false);
    }

    @PostMapping("/{id}/start")
    @Transactional
    public AppointmentView start(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID id,@Valid @RequestBody VersionInput input,Authentication auth){
        return transition(tenant,id,input.version(),auth,"START","IN_PROGRESS",
            Set.of("CONFIRMED"),true);
    }

    @PostMapping("/{id}/complete")
    @Transactional
    public AppointmentView complete(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID id,@Valid @RequestBody VersionInput input,Authentication auth){
        return transition(tenant,id,input.version(),auth,"COMPLETE","COMPLETED",
            Set.of("IN_PROGRESS"),true);
    }

    @PostMapping("/{id}/cancel")
    @Transactional
    public AppointmentView cancel(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID id,@Valid @RequestBody VersionInput input,Authentication auth){
        return transition(tenant,id,input.version(),auth,"CANCEL","CANCELLED",
            Set.of("REQUESTED","CONFIRMED"),false);
    }

    @PostMapping("/{id}/no-show")
    @Transactional
    public AppointmentView noShow(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID id,@Valid @RequestBody VersionInput input,Authentication auth){
        return transition(tenant,id,input.version(),auth,"NO_SHOW","NO_SHOW",
            Set.of("CONFIRMED"),false);
    }

    @PostMapping("/{id}/reschedule")
    @Transactional
    public AppointmentView reschedule(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID id,@Valid @RequestBody RescheduleInput input,Authentication auth){
        var actor=requireReception(auth,tenant);
        var before=find(tenant,id);
        if(!Set.of("REQUESTED","CONFIRMED").contains(before.status())){
            throw new ResponseStatusException(HttpStatus.CONFLICT,"INVALID_APPOINTMENT_STATE");
        }
        if(before.version()!=input.version()){
            throw new ResponseStatusException(HttpStatus.CONFLICT,"STALE_APPOINTMENT_VERSION");
        }
        LocalDateTime end=availability.requireSlot(tenant,before.patientId(),
            before.practitionerUserId(),input.unitId(),before.serviceId(),input.startsAt());
        int changed=jdbc.update("""
            UPDATE appointments SET unit_id=:unit,starts_at=:start,ends_at=:end,
                version=version+1,updated_at=now()
            WHERE tenant_id=:tenant AND id=:id AND version=:version
                AND status IN ('REQUESTED','CONFIRMED')
            """,new MapSqlParameterSource()
                .addValue("tenant",tenant).addValue("id",id).addValue("version",input.version())
                .addValue("unit",input.unitId()).addValue("start",input.startsAt())
                .addValue("end",end));
        if(changed==0) staleOrMissing(tenant,id);
        event(tenant,id,actor.userId(),"RESCHEDULE",before.status(),before.status(),
            before.startsAt(),input.startsAt());
        audit.write(tenant,actor.userId(),"APPOINTMENT_RESCHEDULED","Appointment",id);
        return find(tenant,id);
    }

    private AppointmentView transition(UUID tenant,UUID id,long version,
        Authentication auth,String action,String next,Set<String> allowed,boolean professionalAllowed){
        var actor=tenants.requireMembership(auth,tenant);
        var before=find(tenant,id);
        if(professionalAllowed){
            boolean clinicAdmin=actor.role().equals("CLINIC_ADMIN");
            boolean own=actor.role().equals("PRACTITIONER")
                &&actor.userId().equals(before.practitionerUserId());
            if(!clinicAdmin&&!own) throw new AccessDeniedException("Appointment clinical action denied");
        }else if(!actor.role().equals("CLINIC_ADMIN")&&!actor.role().equals("RECEPTION")){
            throw new AccessDeniedException("Appointment administrative action denied");
        }
        if(!allowed.contains(before.status())){
            throw new ResponseStatusException(HttpStatus.CONFLICT,"INVALID_APPOINTMENT_STATE");
        }
        if(before.version()!=version){
            throw new ResponseStatusException(HttpStatus.CONFLICT,"STALE_APPOINTMENT_VERSION");
        }
        int changed=jdbc.update("""
            UPDATE appointments SET status=:next,version=version+1,updated_at=now()
            WHERE tenant_id=:tenant AND id=:id AND status=:previous AND version=:version
            """,Map.of("tenant",tenant,"id",id,"next",next,
                "previous",before.status(),"version",version));
        if(changed==0) staleOrMissing(tenant,id);
        event(tenant,id,actor.userId(),action,before.status(),next,
            before.startsAt(),before.startsAt());
        audit.write(tenant,actor.userId(),"APPOINTMENT_"+action,"Appointment",id);
        return find(tenant,id);
    }

    private TenantAccessService.TenantAccess requireReception(Authentication auth,UUID tenant){
        var actor=tenants.requireMembership(auth,tenant);
        if(!actor.role().equals("CLINIC_ADMIN")&&!actor.role().equals("RECEPTION")){
            throw new AccessDeniedException("Clinic administration or reception required");
        }
        return actor;
    }

    private void requireCalendarAccess(
        TenantAccessService.TenantAccess actor,AppointmentView existing){
        if(actor.role().equals("CLINIC_ADMIN")||actor.role().equals("RECEPTION")) return;
        if(actor.role().equals("PRACTITIONER")&&actor.userId().equals(existing.practitionerUserId()))
            return;
        throw new AccessDeniedException("Appointment access denied");
    }

    private AppointmentView find(UUID tenant,UUID id){
        return jdbc.query("""
            SELECT id,patient_id,practitioner_user_id,unit_id,service_id,
                starts_at,ends_at,status,version
            FROM appointments WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",tenant,"id",id),(rs,n)->row(rs))
            .stream().findFirst().orElseThrow(()->
                new ResponseStatusException(HttpStatus.NOT_FOUND,"APPOINTMENT_NOT_FOUND"));
    }

    private void staleOrMissing(UUID tenant,UUID id){
        Integer count=jdbc.queryForObject("""
            SELECT count(*) FROM appointments WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",tenant,"id",id),Integer.class);
        throw new ResponseStatusException(count!=null&&count>0
            ?HttpStatus.CONFLICT:HttpStatus.NOT_FOUND,
            count!=null&&count>0?"STALE_APPOINTMENT_VERSION":"APPOINTMENT_NOT_FOUND");
    }

    private void event(UUID tenant,UUID appointment,UUID actor,String action,
                       String oldStatus,String newStatus,
                       LocalDateTime oldStart,LocalDateTime newStart){
        jdbc.update("""
            INSERT INTO appointment_events
                (tenant_id,id,appointment_id,actor_id,action,
                 old_status,new_status,previous_starts_at,new_starts_at)
            VALUES(:tenant,:id,:appointment,:actor,:action,
                   :previous,:next,:oldStart,:newStart)
            """,new MapSqlParameterSource()
                .addValue("tenant",tenant).addValue("id",UUID.randomUUID())
                .addValue("appointment",appointment).addValue("actor",actor)
                .addValue("action",action).addValue("previous",oldStatus)
                .addValue("next",newStatus).addValue("oldStart",oldStart)
                .addValue("newStart",newStart));
    }

    private static String fingerprint(CreateAppointment input){
        String canonical=input.patientId()+"|"+input.practitionerUserId()+"|"
            +input.unitId()+"|"+input.serviceId()+"|"+input.startsAt();
        try{
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        }catch(NoSuchAlgorithmException e){
            throw new IllegalStateException("SHA-256 unavailable",e);
        }
    }

    private static AppointmentView row(ResultSet rs)throws SQLException{
        return new AppointmentView(rs.getObject("id",UUID.class),
            rs.getObject("patient_id",UUID.class),
            rs.getObject("practitioner_user_id",UUID.class),
            rs.getObject("unit_id",UUID.class),rs.getObject("service_id",UUID.class),
            rs.getObject("starts_at",LocalDateTime.class),
            rs.getObject("ends_at",LocalDateTime.class),
            rs.getString("status"),rs.getLong("version"));
    }

    private record ExistingRequest(UUID id,String hash){}
    public record CreateAppointment(@NotNull UUID patientId,@NotNull UUID practitionerUserId,
                                    @NotNull UUID unitId,@NotNull UUID serviceId,
                                    @NotNull LocalDateTime startsAt){}
    public record VersionInput(@NotNull @Min(0) Long version){}
    public record RescheduleInput(@NotNull @Min(0) Long version,
                                  @NotNull UUID unitId,
                                  @NotNull LocalDateTime startsAt){}
    public record AppointmentView(UUID id,UUID patientId,UUID practitionerUserId,
        UUID unitId,UUID serviceId,LocalDateTime startsAt,LocalDateTime endsAt,
        String status,long version){}
}
