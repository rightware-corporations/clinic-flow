package com.rightware.clinicflow.domain.scheduling;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/scheduling")
public class SchedulingController {
    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenants;
    private final AuditWriter audit;

    public SchedulingController(NamedParameterJdbcTemplate jdbc,
                                TenantAccessService tenants,
                                AuditWriter audit) {
        this.jdbc = jdbc;
        this.tenants = tenants;
        this.audit = audit;
    }

    @GetMapping("/rules")
    public List<AvailabilityRule> rules(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @RequestParam UUID practitionerUserId,
        Authentication auth) {
        requireAdminOrSelf(auth, tenant, practitionerUserId);
        return jdbc.query("""
            SELECT id, practitioner_user_id, unit_id, day_of_week,
                   start_time, end_time, slot_interval_minutes, active
            FROM practitioner_availability_rules
            WHERE tenant_id=:tenant AND practitioner_user_id=:user
            ORDER BY day_of_week, start_time, id
            """, Map.of("tenant",tenant,"user",practitionerUserId),
            (rs,row) -> ruleRow(rs));
    }

    @PostMapping("/rules")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AvailabilityRule createRule(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @Valid @RequestBody AvailabilityRuleInput input,
        Authentication auth) {
        var actor = requireAdminOrSelf(auth, tenant, input.practitionerUserId());
        requireActiveProfessionalAndUnit(tenant, input.practitionerUserId(), input.unitId());
        rejectOverlappingRule(tenant, null, input);
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO practitioner_availability_rules
                (id,tenant_id,practitioner_user_id,unit_id,day_of_week,
                 start_time,end_time,slot_interval_minutes)
            VALUES(:id,:tenant,:user,:unit,:day,:start,:end,:interval)
            """, ruleArgs(tenant,id,input));
        audit.write(tenant, actor.userId(), "SCHEDULE_RULE_CREATED", "AvailabilityRule", id);
        return findRule(tenant,id);
    }

    @PutMapping("/rules/{id}")
    @Transactional
    public AvailabilityRule updateRule(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID id,
        @Valid @RequestBody AvailabilityRuleInput input,
        Authentication auth) {
        var existing = findRule(tenant,id);
        var actor = requireAdminOrSelf(auth, tenant, existing.practitionerUserId());
        if (!existing.practitionerUserId().equals(input.practitionerUserId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PRACTITIONER_IMMUTABLE");
        }
        requireActiveProfessionalAndUnit(tenant, input.practitionerUserId(), input.unitId());
        rejectOverlappingRule(tenant,id,input);
        int changed = jdbc.update("""
            UPDATE practitioner_availability_rules
            SET unit_id=:unit, day_of_week=:day, start_time=:start,
                end_time=:end, slot_interval_minutes=:interval
            WHERE tenant_id=:tenant AND id=:id AND active
            """, ruleArgs(tenant,id,input));
        if (changed == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ACTIVE_RULE_NOT_FOUND");
        }
        audit.write(tenant, actor.userId(), "SCHEDULE_RULE_UPDATED", "AvailabilityRule", id);
        return findRule(tenant,id);
    }

    @PostMapping("/rules/{id}/deactivate")
    @Transactional
    public AvailabilityRule deactivateRule(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID id, Authentication auth) {
        var existing = findRule(tenant,id);
        var actor = requireAdminOrSelf(auth, tenant, existing.practitionerUserId());
        int changed = jdbc.update("""
            UPDATE practitioner_availability_rules SET active=false
            WHERE tenant_id=:tenant AND id=:id AND active
            """, Map.of("tenant",tenant,"id",id));
        if (changed == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ACTIVE_RULE_NOT_FOUND");
        }
        audit.write(tenant, actor.userId(), "SCHEDULE_RULE_DEACTIVATED", "AvailabilityRule", id);
        return findRule(tenant,id);
    }

    @GetMapping("/blocks")
    public List<ScheduleBlock> blocks(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @RequestParam UUID practitionerUserId,
        @RequestParam @NotNull LocalDate from,
        @RequestParam @NotNull LocalDate to,
        Authentication auth) {
        requireAdminOrSelf(auth,tenant,practitionerUserId);
        if (to.isBefore(from) || to.isAfter(from.plusDays(90))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_BLOCK_RANGE");
        }
        return jdbc.query("""
            SELECT id, practitioner_user_id, starts_at, ends_at, reason
            FROM practitioner_schedule_blocks
            WHERE tenant_id=:tenant AND practitioner_user_id=:user
              AND starts_at < :to AND ends_at >= :from
            ORDER BY starts_at
            """, new MapSqlParameterSource()
                .addValue("tenant",tenant).addValue("user",practitionerUserId)
                .addValue("from",from.atStartOfDay())
                .addValue("to",to.plusDays(1).atStartOfDay()),
            (rs,row) -> blockRow(rs));
    }

    @PostMapping("/blocks")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ScheduleBlock createBlock(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @Valid @RequestBody ScheduleBlockInput input,
        Authentication auth) {
        var actor = requireAdminOrSelf(auth,tenant,input.practitionerUserId());
        requireActiveProfessional(tenant,input.practitionerUserId());
        if (!input.endsAt().isAfter(input.startsAt())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_BLOCK_TIME");
        }
        if (input.endsAt().isAfter(input.startsAt().plusDays(31))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "BLOCK_TOO_LONG");
        }
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO practitioner_schedule_blocks
                (id,tenant_id,practitioner_user_id,starts_at,ends_at,reason,created_by)
            VALUES(:id,:tenant,:user,:start,:end,:reason,:actor)
            """, new MapSqlParameterSource()
                .addValue("id",id).addValue("tenant",tenant)
                .addValue("user",input.practitionerUserId())
                .addValue("start",input.startsAt()).addValue("end",input.endsAt())
                .addValue("reason",optional(input.reason())).addValue("actor",actor.userId()));
        audit.write(tenant,actor.userId(),"SCHEDULE_BLOCK_CREATED","ScheduleBlock",id);
        return findBlock(tenant,id);
    }

    @DeleteMapping("/blocks/{id}")
    @Transactional
    public Map<String,Boolean> deleteBlock(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @PathVariable UUID id, Authentication auth) {
        var existing=findBlock(tenant,id);
        var actor=requireAdminOrSelf(auth,tenant,existing.practitionerUserId());
        int changed=jdbc.update("""
            DELETE FROM practitioner_schedule_blocks
            WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",tenant,"id",id));
        if(changed==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"BLOCK_NOT_FOUND");
        audit.write(tenant,actor.userId(),"SCHEDULE_BLOCK_REMOVED","ScheduleBlock",id);
        return Map.of("deleted",true);
    }

    @GetMapping("/slot-preview")
    public SlotPreview preview(
        @RequestHeader("X-Clinicflow-Tenant") UUID tenant,
        @RequestParam UUID practitionerUserId,
        @RequestParam UUID serviceId,
        @RequestParam @NotNull LocalDate date,
        Authentication auth) {
        requireAdminOrSelf(auth,tenant,practitionerUserId);
        if(date.isBefore(LocalDate.now()) || date.isAfter(LocalDate.now().plusDays(180))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"DATE_OUT_OF_RANGE");
        }
        requireActiveProfessional(tenant,practitionerUserId);
        Integer duration=jdbc.queryForObject("""
            SELECT sd.duration_minutes
            FROM practitioner_services ps
            JOIN service_definitions sd
              ON sd.tenant_id=ps.tenant_id AND sd.id=ps.service_id
            WHERE ps.tenant_id=:tenant AND ps.practitioner_user_id=:user
              AND ps.service_id=:service AND sd.active
            """,Map.of("tenant",tenant,"user",practitionerUserId,"service",serviceId),Integer.class);
        if(duration==null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"SERVICE_NOT_ASSIGNED");

        List<AvailabilityRule> dayRules=jdbc.query("""
            SELECT id, practitioner_user_id, unit_id, day_of_week,
                   start_time, end_time, slot_interval_minutes, active
            FROM practitioner_availability_rules
            WHERE tenant_id=:tenant AND practitioner_user_id=:user
              AND day_of_week=:day AND active
            ORDER BY start_time
            """,Map.of("tenant",tenant,"user",practitionerUserId,
                "day",date.getDayOfWeek().getValue()),(rs,row)->ruleRow(rs));

        List<ScheduleBlock> dayBlocks=jdbc.query("""
            SELECT id, practitioner_user_id, starts_at, ends_at, reason
            FROM practitioner_schedule_blocks
            WHERE tenant_id=:tenant AND practitioner_user_id=:user
              AND starts_at < :dayEnd AND ends_at > :dayStart
            """,new MapSqlParameterSource().addValue("tenant",tenant)
                .addValue("user",practitionerUserId).addValue("dayStart",date.atStartOfDay())
                .addValue("dayEnd",date.plusDays(1).atStartOfDay()),(rs,row)->blockRow(rs));

        TreeMap<String,SlotView> slots=new TreeMap<>();
        for(var rule:dayRules){
            LocalDateTime cursor=LocalDateTime.of(date,rule.startTime());
            LocalDateTime boundary=LocalDateTime.of(date,rule.endTime());
            Duration serviceDuration=Duration.ofMinutes(duration);
            Duration interval=Duration.ofMinutes(rule.slotIntervalMinutes());
            while(!cursor.plus(serviceDuration).isAfter(boundary)){
                LocalDateTime slotStart=cursor;
                LocalDateTime end=slotStart.plus(serviceDuration);
                boolean blocked=dayBlocks.stream().anyMatch(b->
                    slotStart.isBefore(b.endsAt()) && end.isAfter(b.startsAt()));
                if(!blocked){
                    String key=slotStart.toLocalTime()+"|"+rule.unitId();
                    slots.putIfAbsent(key,new SlotView(slotStart.toLocalTime(),end.toLocalTime(),rule.unitId()));
                }
                cursor=cursor.plus(interval);
            }
        }
        return new SlotPreview(date,practitionerUserId,serviceId,duration,List.copyOf(slots.values()));
    }

    private TenantAccessService.TenantAccess requireAdminOrSelf(
        Authentication auth,UUID tenant,UUID practitionerUserId){
        var access=tenants.requireMembership(auth,tenant);
        if(access.role().equals("CLINIC_ADMIN")) return access;
        if(access.role().equals("PRACTITIONER") && access.userId().equals(practitionerUserId)) return access;
        throw new AccessDeniedException("Schedule access requires clinic admin or profile owner");
    }

    private void requireActiveProfessionalAndUnit(UUID tenant,UUID user,UUID unit){
        requireActiveProfessional(tenant,user);
        Integer count=jdbc.queryForObject("""
            SELECT count(*) FROM practitioner_units pu
            JOIN clinic_units cu ON cu.tenant_id=pu.tenant_id AND cu.id=pu.unit_id
            WHERE pu.tenant_id=:tenant AND pu.practitioner_user_id=:user
              AND pu.unit_id=:unit AND cu.active
            """,Map.of("tenant",tenant,"user",user,"unit",unit),Integer.class);
        if(count==null||count==0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"UNIT_NOT_ASSIGNED");
    }

    private void requireActiveProfessional(UUID tenant,UUID user){
        Integer count=jdbc.queryForObject("""
            SELECT count(*) FROM practitioner_profiles p
            JOIN tenant_memberships m
              ON m.tenant_id=p.tenant_id AND m.user_id=p.user_id
            WHERE p.tenant_id=:tenant AND p.user_id=:user AND p.active AND m.active
              AND m.role='PRACTITIONER'
            """,Map.of("tenant",tenant,"user",user),Integer.class);
        if(count==null||count==0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"ACTIVE_PRACTITIONER_REQUIRED");
    }

    private void rejectOverlappingRule(UUID tenant,UUID ignoreId,AvailabilityRuleInput input){
        var params=new MapSqlParameterSource().addValue("tenant",tenant)
            .addValue("user",input.practitionerUserId()).addValue("day",input.dayOfWeek())
            .addValue("start",input.startTime()).addValue("end",input.endTime())
            .addValue("ignore",ignoreId);
        Integer count=jdbc.queryForObject("""
            SELECT count(*) FROM practitioner_availability_rules
            WHERE tenant_id=:tenant AND practitioner_user_id=:user AND day_of_week=:day
              AND active AND (:ignore IS NULL OR id<>:ignore)
              AND start_time < :end AND end_time > :start
            """,params,Integer.class);
        if(count!=null&&count>0) throw new ResponseStatusException(HttpStatus.CONFLICT,"OVERLAPPING_AVAILABILITY_RULE");
    }

    private AvailabilityRule findRule(UUID tenant,UUID id){
        return jdbc.query("""
            SELECT id, practitioner_user_id, unit_id, day_of_week,
                   start_time, end_time, slot_interval_minutes, active
            FROM practitioner_availability_rules WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",tenant,"id",id),(rs,row)->ruleRow(rs))
            .stream().findFirst().orElseThrow(()->
                new ResponseStatusException(HttpStatus.NOT_FOUND,"RULE_NOT_FOUND"));
    }

    private ScheduleBlock findBlock(UUID tenant,UUID id){
        return jdbc.query("""
            SELECT id, practitioner_user_id, starts_at, ends_at, reason
            FROM practitioner_schedule_blocks WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",tenant,"id",id),(rs,row)->blockRow(rs))
            .stream().findFirst().orElseThrow(()->
                new ResponseStatusException(HttpStatus.NOT_FOUND,"BLOCK_NOT_FOUND"));
    }

    private static AvailabilityRule ruleRow(ResultSet rs)throws SQLException{
        return new AvailabilityRule(rs.getObject("id",UUID.class),
            rs.getObject("practitioner_user_id",UUID.class),rs.getObject("unit_id",UUID.class),
            rs.getInt("day_of_week"),rs.getObject("start_time",LocalTime.class),
            rs.getObject("end_time",LocalTime.class),rs.getInt("slot_interval_minutes"),
            rs.getBoolean("active"));
    }
    private static ScheduleBlock blockRow(ResultSet rs)throws SQLException{
        return new ScheduleBlock(rs.getObject("id",UUID.class),
            rs.getObject("practitioner_user_id",UUID.class),
            rs.getObject("starts_at",LocalDateTime.class),rs.getObject("ends_at",LocalDateTime.class),
            rs.getString("reason"));
    }
    private static MapSqlParameterSource ruleArgs(UUID tenant,UUID id,AvailabilityRuleInput input){
        return new MapSqlParameterSource().addValue("id",id).addValue("tenant",tenant)
            .addValue("user",input.practitionerUserId()).addValue("unit",input.unitId())
            .addValue("day",input.dayOfWeek()).addValue("start",input.startTime())
            .addValue("end",input.endTime()).addValue("interval",input.slotIntervalMinutes());
    }
    private static String optional(String v){return v==null||v.isBlank()?null:v.trim();}

    public record AvailabilityRuleInput(@NotNull UUID practitionerUserId,@NotNull UUID unitId,
        @Min(1) @Max(7) int dayOfWeek,@NotNull LocalTime startTime,@NotNull LocalTime endTime,
        @Min(5) @Max(120) int slotIntervalMinutes){}
    public record AvailabilityRule(UUID id,UUID practitionerUserId,UUID unitId,int dayOfWeek,
        LocalTime startTime,LocalTime endTime,int slotIntervalMinutes,boolean active){}
    public record ScheduleBlockInput(@NotNull UUID practitionerUserId,@NotNull LocalDateTime startsAt,
        @NotNull LocalDateTime endsAt,@Size(max=250) String reason){}
    public record ScheduleBlock(UUID id,UUID practitionerUserId,LocalDateTime startsAt,
        LocalDateTime endsAt,String reason){}
    public record SlotView(LocalTime startsAt,LocalTime endsAt,UUID unitId){}
    public record SlotPreview(LocalDate date,UUID practitionerUserId,UUID serviceId,
        int serviceDurationMinutes,List<SlotView> slots){}
}
