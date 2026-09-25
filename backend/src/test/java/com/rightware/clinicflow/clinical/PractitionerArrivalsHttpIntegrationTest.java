package com.rightware.clinicflow.clinical;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class PractitionerArrivalsHttpIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired NamedParameterJdbcTemplate jdbc;

    @Test
    void practitionersSeeOnlyOwnAppointmentsAndOnlyMinimalArrivalFields() throws Exception {
        Fixture f = fixture();
        String path = "/api/v1/practitioner/arrivals";
        String date = f.date().toString();

        mvc.perform(get(path).with(user(email(f.doctorA())))
                .header("X-Clinicflow-Tenant", f.tenant()).param("date",date))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].appointmentId").value(f.appointmentA().toString()))
            .andExpect(jsonPath("$[0].queueStatus").value("WAITING"))
            .andExpect(jsonPath("$[0].arrivedAt").isNotEmpty())
            .andExpect(jsonPath("$[0].calledAt").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$[0].patientName").doesNotExist())
            .andExpect(jsonPath("$[0].diagnosis").doesNotExist());

        mvc.perform(get(path).with(user(email(f.doctorB())))
                .header("X-Clinicflow-Tenant", f.tenant()).param("date",date))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].appointmentId").value(f.appointmentB().toString()))
            .andExpect(jsonPath("$[0].queueStatus").value("CALLED"))
            .andExpect(jsonPath("$[0].calledAt").isNotEmpty());

        mvc.perform(get(path).with(user(email(f.doctorA())))
                .header("X-Clinicflow-Tenant", f.tenant())
                .param("date",f.date().plusDays(1).toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));

        assertEquals(3, jdbc.queryForObject("""
            SELECT count(*) FROM audit_events
            WHERE tenant_id=:tenant AND action='PRACTITIONER_ARRIVALS_VIEWED'
            """,Map.of("tenant",f.tenant()),Integer.class));
    }

    @Test
    void otherRolesForeignTenantsAndUnauthenticatedRequestsAreDenied() throws Exception {
        Fixture f = fixture();
        String path="/api/v1/practitioner/arrivals";
        for (UUID denied: List.of(f.admin(),f.reception(),f.intern(),f.patientUser())) {
            mvc.perform(get(path).with(user(email(denied)))
                    .header("X-Clinicflow-Tenant",f.tenant())
                    .param("date",f.date().toString()))
                .andExpect(status().isForbidden());
        }
        mvc.perform(get(path).with(user(email(f.foreignDoctor())))
                .header("X-Clinicflow-Tenant",f.tenant())
                .param("date",f.date().toString()))
            .andExpect(status().isForbidden());
        mvc.perform(get(path)
                .header("X-Clinicflow-Tenant",f.tenant())
                .param("date",f.date().toString()))
            .andExpect(status().isUnauthorized());
    }

    private Fixture fixture() {
        UUID tenant=UUID.randomUUID(),foreign=UUID.randomUUID();
        write("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id",tenant,"name","Practitioner arrivals "+tenant));
        write("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id",foreign,"name","Foreign arrivals "+foreign));

        UUID doctorA=userIn(tenant,"PRACTITIONER"), doctorB=userIn(tenant,"PRACTITIONER");
        UUID admin=userIn(tenant,"CLINIC_ADMIN"),reception=userIn(tenant,"RECEPTION");
        UUID intern=userIn(tenant,"INTERN"),patientUser=userIn(tenant,"PATIENT");
        UUID foreignDoctor=userIn(foreign,"PRACTITIONER");
        UUID unit=UUID.randomUUID(),service=UUID.randomUUID();
        write("INSERT INTO clinic_units(id,tenant_id,name) VALUES(:id,:tenant,'Main')",
            Map.of("id",unit,"tenant",tenant));
        write("""
            INSERT INTO service_definitions(id,tenant_id,name,slug,duration_minutes)
            VALUES(:id,:tenant,'Consultation',:slug,30)
            """,Map.of("id",service,"tenant",tenant,"slug","arrival-"+service));
        for (UUID doctor: List.of(doctorA,doctorB)) {
            write("""
                INSERT INTO practitioner_profiles(tenant_id,user_id,professional_title)
                VALUES(:tenant,:doctor,'Doctor')
                """,Map.of("tenant",tenant,"doctor",doctor));
        }
        LocalDate date=LocalDate.now(ZoneId.of("Africa/Maputo"));
        UUID appointmentA=appointment(tenant,doctorA,admin,unit,service,date.atTime(9,0));
        UUID appointmentB=appointment(tenant,doctorB,admin,unit,service,date.atTime(9,0));
        arrival(tenant,appointmentA,reception,false);
        arrival(tenant,appointmentB,reception,true);
        return new Fixture(tenant,doctorA,doctorB,admin,reception,intern,patientUser,
            foreignDoctor,appointmentA,appointmentB,date);
    }

    private UUID appointment(UUID tenant,UUID doctor,UUID creator,UUID unit,
                             UUID service,LocalDateTime starts) {
        UUID patient=UUID.randomUUID(),id=UUID.randomUUID();
        write("""
            INSERT INTO patients(id,tenant_id,name,date_of_birth,gender)
            VALUES(:id,:tenant,'Synthetic Patient','1990-01-01','F')
            """,Map.of("id",patient,"tenant",tenant));
        jdbc.update("""
            INSERT INTO appointments(id,tenant_id,patient_id,practitioner_user_id,
                unit_id,service_id,starts_at,ends_at,status,created_by,idempotency_key,request_hash)
            VALUES(:id,:tenant,:patient,:doctor,:unit,:service,
                :start,:end,'CONFIRMED',:creator,:key,:hash)
            """,new org.springframework.jdbc.core.namedparam.MapSqlParameterSource()
            .addValue("id",id).addValue("tenant",tenant).addValue("patient",patient)
            .addValue("doctor",doctor).addValue("unit",unit).addValue("service",service)
            .addValue("start",starts).addValue("end",starts.plusMinutes(30))
            .addValue("creator",creator).addValue("key",UUID.randomUUID())
            .addValue("hash","0".repeat(64)));
        return id;
    }

    private void arrival(UUID tenant,UUID appointment,UUID reception,boolean called) {
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO reception_checkins(tenant_id,id,appointment_id,checked_in_by,
                queue_status,called_at,called_by)
            VALUES(:tenant,:id,:appointment,:reception,:status,:calledAt,:calledBy)
            """,new org.springframework.jdbc.core.namedparam.MapSqlParameterSource()
            .addValue("tenant",tenant).addValue("id",id)
            .addValue("appointment",appointment).addValue("reception",reception)
            .addValue("status",called?"CALLED":"WAITING")
            .addValue("calledAt",called?OffsetDateTime.now():null)
            .addValue("calledBy",called?reception:null));
    }

    private UUID userIn(UUID tenant,String role) {
        UUID id=UUID.randomUUID();
        write("""
            INSERT INTO users(id,email,display_name,password_hash)
            VALUES(:id,:email,:name,'synthetic-only')
            """,Map.of("id",id,"email",email(id),"name",role));
        write("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:id,:role)
            """,Map.of("tenant",tenant,"id",id,"role",role));
        return id;
    }
    private void write(String sql,Map<String,?> params){jdbc.update(sql,params);}
    private String email(UUID user){return "practitioner-arrivals-"+user+"@example.invalid";}
    private record Fixture(UUID tenant,UUID doctorA,UUID doctorB,UUID admin,
                           UUID reception,UUID intern,UUID patientUser,UUID foreignDoctor,
                           UUID appointmentA,UUID appointmentB,LocalDate date){}
}
