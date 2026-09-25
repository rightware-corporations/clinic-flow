package com.rightware.clinicflow.reception;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class ReceptionQueueHttpIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired NamedParameterJdbcTemplate jdbc;
    private static final ZoneId MAPUTO=ZoneId.of("Africa/Maputo");

    @Test
    void arrivalAndCallAreRealAuditedIdempotentAndRoleBound() throws Exception {
        Fixture f=fixture(LocalDate.now(MAPUTO));
        mvc.perform(post("/api/v1/reception/check-ins")
            .with(user(email(f.intern()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON)
            .content(checkInBody(f.appointment(),2)))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/reception/check-ins")
            .with(user(email(f.reception())))
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON)
            .content(checkInBody(f.appointment(),2)))
            .andExpect(status().isForbidden()); // CSRF is still mandatory.
        mvc.perform(get("/api/v1/reception/queue")
            .with(user(email(f.practitioner())))
            .header("X-Clinicflow-Tenant",f.tenant())
            .param("date",LocalDate.now(MAPUTO).toString()))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/reception/queue")
            .with(user(email(f.foreignAdmin())))
            .header("X-Clinicflow-Tenant",f.tenant())
            .param("date",LocalDate.now(MAPUTO).toString()))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/reception/check-ins")
            .with(user(email(f.reception()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON)
            .content(checkInBody(f.appointment(),0)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("STALE_APPOINTMENT_VERSION"));

        mvc.perform(post("/api/v1/reception/check-ins")
            .with(user(email(f.reception()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON)
            .content(checkInBody(f.appointment(),2)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.queueStatus").value("WAITING"))
            .andExpect(jsonPath("$.patientName").isNotEmpty());
        UUID checkin=jdbc.queryForObject("""
            SELECT id FROM reception_checkins
            WHERE tenant_id=:tenant AND appointment_id=:appointment
            """,Map.of("tenant",f.tenant(),"appointment",f.appointment()),UUID.class);
        assertNotNull(checkin);

        mvc.perform(post("/api/v1/reception/check-ins")
            .with(user(email(f.admin()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON)
            .content(checkInBody(f.appointment(),2)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(checkin.toString()));
        assertEquals(1,jdbc.queryForObject("""
            SELECT count(*) FROM reception_checkins
            WHERE tenant_id=:tenant AND appointment_id=:appointment
            """,Map.of("tenant",f.tenant(),"appointment",f.appointment()),Integer.class));

        mvc.perform(get("/api/v1/reception/queue")
            .with(user(email(f.reception())))
            .header("X-Clinicflow-Tenant",f.tenant())
            .param("date",LocalDate.now(MAPUTO).toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].appointmentId").value(f.appointment().toString()))
            .andExpect(jsonPath("$[0].queueStatus").value("WAITING"))
            .andExpect(jsonPath("$[0].diagnosis").doesNotExist());

        mvc.perform(post("/api/v1/appointments/"+f.appointment()+"/cancel")
            .with(user(email(f.reception()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("PATIENT_ALREADY_CHECKED_IN"));
        mvc.perform(post("/api/v1/appointments/"+f.appointment()+"/no-show")
            .with(user(email(f.reception()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("PATIENT_ALREADY_CHECKED_IN"));

        mvc.perform(post("/api/v1/reception/queue/"+checkin+"/call")
            .with(user(email(f.reception()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.queueStatus").value("CALLED"))
            .andExpect(jsonPath("$.queueVersion").value(1));
        mvc.perform(post("/api/v1/reception/queue/"+checkin+"/call")
            .with(user(email(f.reception()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
            .andExpect(status().isConflict());
        assertEquals(2,jdbc.queryForObject("""
            SELECT count(*) FROM reception_queue_events
            WHERE tenant_id=:tenant AND checkin_id=:id
            """,Map.of("tenant",f.tenant(),"id",checkin),Integer.class));
    }

    @Test
    void dateBoundaryAndTenantIsolationAreEnforced() throws Exception {
        Fixture tomorrow=fixture(LocalDate.now(MAPUTO).plusDays(1));
        mvc.perform(post("/api/v1/reception/check-ins")
            .with(user(email(tomorrow.reception()))).with(csrf())
            .header("X-Clinicflow-Tenant",tomorrow.tenant())
            .contentType(MediaType.APPLICATION_JSON)
            .content(checkInBody(tomorrow.appointment(),2)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("CHECK_IN_DATE_MISMATCH"));
        mvc.perform(get("/api/v1/reception/queue")
            .with(user(email(tomorrow.reception())))
            .header("X-Clinicflow-Tenant",tomorrow.tenant())
            .param("date",LocalDate.now(MAPUTO).toString())
            .param("unitId",tomorrow.foreignUnit().toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    private Fixture fixture(LocalDate date){
        UUID tenant=UUID.randomUUID(),foreign=UUID.randomUUID();
        insert("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id",tenant,"name","Reception "+tenant));
        insert("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id",foreign,"name","Foreign "+foreign));
        UUID admin=createUser(tenant,"CLINIC_ADMIN");
        UUID reception=createUser(tenant,"RECEPTION");
        UUID practitioner=createUser(tenant,"PRACTITIONER");
        UUID intern=createUser(tenant,"INTERN");
        UUID foreignAdmin=createUser(foreign,"CLINIC_ADMIN");
        UUID patient=UUID.randomUUID(),unit=UUID.randomUUID(),foreignUnit=UUID.randomUUID();
        UUID service=UUID.randomUUID(),appointment=UUID.randomUUID();
        insert("""
            INSERT INTO patients(id,tenant_id,name,date_of_birth,gender)
            VALUES(:id,:tenant,'Synthetic Patient','1990-03-10','F')
            """,Map.of("id",patient,"tenant",tenant));
        insert("INSERT INTO clinic_units(id,tenant_id,name) VALUES(:id,:tenant,'Main')",
            Map.of("id",unit,"tenant",tenant));
        insert("INSERT INTO clinic_units(id,tenant_id,name) VALUES(:id,:tenant,'Foreign')",
            Map.of("id",foreignUnit,"tenant",foreign));
        insert("""
            INSERT INTO service_definitions(id,tenant_id,name,slug,duration_minutes)
            VALUES(:id,:tenant,'General',:slug,30)
            """,Map.of("id",service,"tenant",tenant,"slug","service-"+service));
        insert("""
            INSERT INTO practitioner_profiles(tenant_id,user_id,professional_title)
            VALUES(:tenant,:user,'Physician')
            """,Map.of("tenant",tenant,"user",practitioner));
        var at=date.atTime(9,0);
        jdbc.update("""
            INSERT INTO appointments(id,tenant_id,patient_id,practitioner_user_id,
                unit_id,service_id,starts_at,ends_at,status,version,
                created_by,idempotency_key,request_hash)
            VALUES(:id,:tenant,:patient,:professional,:unit,:service,:start,:end,
                'CONFIRMED',2,:actor,:key,:hash)
            """,new org.springframework.jdbc.core.namedparam.MapSqlParameterSource()
                .addValue("id",appointment).addValue("tenant",tenant)
                .addValue("patient",patient).addValue("professional",practitioner)
                .addValue("unit",unit).addValue("service",service)
                .addValue("start",at).addValue("end",at.plusMinutes(30))
                .addValue("actor",admin).addValue("key",UUID.randomUUID())
                .addValue("hash","0".repeat(64)));
        return new Fixture(tenant,admin,reception,practitioner,intern,foreignAdmin,
            appointment,foreignUnit);
    }
    private UUID createUser(UUID tenant,String role) {
        UUID id=UUID.randomUUID();
        insert("""
            INSERT INTO users(id,email,display_name,password_hash)
            VALUES(:id,:email,:name,'test-only')
            """,Map.of("id",id,"email",email(id),"name",role));
        insert("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:id,:role)
            """,Map.of("tenant",tenant,"id",id,"role",role));
        return id;
    }
    private void insert(String sql,Map<String,?> args){jdbc.update(sql,args);}
    private String email(UUID id){return "reception-"+id+"@example.invalid";}
    private String checkInBody(UUID id,long version){
        return "{\"appointmentId\":\""+id+"\",\"appointmentVersion\":"+version+"}";
    }
    private record Fixture(UUID tenant,UUID admin,UUID reception,UUID practitioner,
        UUID intern,UUID foreignAdmin,UUID appointment,UUID foreignUnit){}
}
