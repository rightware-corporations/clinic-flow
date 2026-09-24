package com.rightware.clinicflow.domain.appointments;

import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * CF-B5 conservative internal scheduling gate; the SQL exclusion constraints
 * are definitive for conflicting bookings under concurrent transactions.
 * Production still requires per-tenant timezone and external booking policies.
 */
@Service
public class AppointmentAvailabilityService {
    private final NamedParameterJdbcTemplate jdbc;

    public AppointmentAvailabilityService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc=jdbc;
    }

    /**
     * Must run inside caller's transaction. Serialises bookings and block creation
     * for the same professional; GiST exclusion remains the final conflict guard.
     */
    @org.springframework.transaction.annotation.Transactional(
        propagation=org.springframework.transaction.annotation.Propagation.MANDATORY)
    public LocalDateTime requireSlot(UUID tenant, UUID patient, UUID practitioner,
                                     UUID unit, UUID service, LocalDateTime start) {
        List<UUID> locked=jdbc.queryForList("""
            SELECT user_id FROM practitioner_profiles
            WHERE tenant_id=:tenant AND user_id=:professional FOR UPDATE
            """,Map.of("tenant",tenant,"professional",practitioner),UUID.class);
        if(locked.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"ACTIVE_PRACTITIONER_REQUIRED");
        }
        LocalDate now=LocalDate.now();
        if (start.toLocalDate().isBefore(now) ||
            start.toLocalDate().isAfter(now.plusDays(180))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"APPOINTMENT_DATE_OUT_OF_RANGE");
        }
        Integer validPatient=jdbc.queryForObject("""
            SELECT count(*) FROM patients
            WHERE tenant_id=:tenant AND id=:patient AND archived_at IS NULL
            """,Map.of("tenant",tenant,"patient",patient),Integer.class);
        if(validPatient==null||validPatient==0){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"ACTIVE_PATIENT_REQUIRED");
        }
        Integer validProfessional=jdbc.queryForObject("""
            SELECT count(*) FROM practitioner_profiles p
            JOIN tenant_memberships m ON m.tenant_id=p.tenant_id AND m.user_id=p.user_id
            JOIN users u ON u.id=p.user_id
            JOIN practitioner_units pu ON pu.tenant_id=p.tenant_id
                AND pu.practitioner_user_id=p.user_id
            JOIN clinic_units cu ON cu.tenant_id=pu.tenant_id AND cu.id=pu.unit_id
            WHERE p.tenant_id=:tenant AND p.user_id=:professional
              AND pu.unit_id=:unit AND cu.active
              AND p.active AND m.active AND m.role='PRACTITIONER' AND u.enabled
            """,Map.of("tenant",tenant,"professional",practitioner,"unit",unit),Integer.class);
        if(validProfessional==null||validProfessional==0){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"PROFESSIONAL_UNIT_UNAVAILABLE");
        }
        List<Integer> durations=jdbc.queryForList("""
            SELECT sd.duration_minutes
            FROM practitioner_services ps
            JOIN service_definitions sd ON sd.tenant_id=ps.tenant_id AND sd.id=ps.service_id
            WHERE ps.tenant_id=:tenant AND ps.practitioner_user_id=:professional
              AND ps.service_id=:service AND sd.active
            """,Map.of("tenant",tenant,"professional",practitioner,"service",service),Integer.class);
        if(durations.isEmpty()){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"SERVICE_NOT_ASSIGNED");
        }
        LocalDateTime end=start.plusMinutes(durations.getFirst());
        if(!end.toLocalDate().equals(start.toLocalDate())){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"APPOINTMENT_MUST_END_SAME_DAY");
        }
        record Rule(LocalTime from,LocalTime to,int interval){}
        List<Rule> rules=jdbc.query("""
            SELECT start_time,end_time,slot_interval_minutes
            FROM practitioner_availability_rules
            WHERE tenant_id=:tenant AND practitioner_user_id=:professional AND unit_id=:unit
              AND day_of_week=:day AND active
            """,Map.of("tenant",tenant,"professional",practitioner,"unit",unit,
                "day",start.getDayOfWeek().getValue()),(rs,row)->
                new Rule(rs.getObject("start_time",LocalTime.class),
                    rs.getObject("end_time",LocalTime.class),rs.getInt("slot_interval_minutes")));
        boolean fits=rules.stream().anyMatch(rule->
            !start.toLocalTime().isBefore(rule.from()) &&
            !end.toLocalTime().isAfter(rule.to()) &&
            Duration.between(rule.from(),start.toLocalTime()).toMinutes()
                %rule.interval()==0);
        if(!fits){
            throw new ResponseStatusException(HttpStatus.CONFLICT,"SLOT_OUTSIDE_AVAILABILITY");
        }
        Integer blocks=jdbc.queryForObject("""
            SELECT count(*) FROM practitioner_schedule_blocks
            WHERE tenant_id=:tenant AND practitioner_user_id=:professional
              AND starts_at < :end AND ends_at > :start
            """,new org.springframework.jdbc.core.namedparam.MapSqlParameterSource()
                .addValue("tenant",tenant).addValue("professional",practitioner)
                .addValue("start",start).addValue("end",end),Integer.class);
        if(blocks!=null&&blocks>0){
            throw new ResponseStatusException(HttpStatus.CONFLICT,"SLOT_BLOCKED");
        }
        return end;
    }
}
