package com.rightware.clinicflow.clinical;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class ClinicalReportHttpIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired NamedParameterJdbcTemplate jdbc;

    @Test
    void ownerOnlyDraftFinalizationAndImmutableAddendaAreEnforced() throws Exception {
        Fixture f=fixture();
        String draft=reportJson(f.appointment(),0,"Initial diagnosis");

        mvc.perform(post("/api/v1/clinical-reports")
                .with(user(email(f.practitioner()))).with(csrf())
                .header("X-Clinicflow-Tenant",f.tenant())
                .contentType(MediaType.APPLICATION_JSON).content(draft))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.summary.status").value("DRAFT"))
            .andExpect(jsonPath("$.diagnosis").value("Initial diagnosis"));

        UUID report=jdbc.queryForObject("""
            SELECT id FROM clinical_reports
            WHERE tenant_id=:tenant AND appointment_id=:appointment
            """,Map.of("tenant",f.tenant(),"appointment",f.appointment()),UUID.class);
        assertNotNull(report);

        // Administrative membership never grants access to clinical content.
        mvc.perform(get("/api/v1/clinical-reports/"+report)
                .with(user(email(f.admin())))
                .header("X-Clinicflow-Tenant",f.tenant()))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/clinical-reports/"+report)
                .with(user(email(f.reception())))
                .header("X-Clinicflow-Tenant",f.tenant()))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/clinical-reports/"+report)
                .with(user(email(f.intern())))
                .header("X-Clinicflow-Tenant",f.tenant()))
            .andExpect(status().isForbidden());

        // Forging a different tenant header cannot cross the membership boundary.
        mvc.perform(get("/api/v1/clinical-reports/"+report)
                .with(user(email(f.practitioner())))
                .header("X-Clinicflow-Tenant",f.otherTenant()))
            .andExpect(status().isForbidden());

        String edited=reportJson(f.appointment(),0,"Updated diagnosis");
        mvc.perform(put("/api/v1/clinical-reports/"+report)
                .with(user(email(f.practitioner()))).with(csrf())
                .header("X-Clinicflow-Tenant",f.tenant())
                .contentType(MediaType.APPLICATION_JSON).content(edited))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary.version").value(1))
            .andExpect(jsonPath("$.diagnosis").value("Updated diagnosis"));

        // Old optimistic version must never overwrite a newer draft.
        mvc.perform(put("/api/v1/clinical-reports/"+report)
                .with(user(email(f.practitioner()))).with(csrf())
                .header("X-Clinicflow-Tenant",f.tenant())
                .contentType(MediaType.APPLICATION_JSON).content(edited))
            .andExpect(status().isConflict());

        mvc.perform(post("/api/v1/clinical-reports/"+report+"/finalize")
                .with(user(email(f.practitioner()))).with(csrf())
                .header("X-Clinicflow-Tenant",f.tenant())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary.status").value("FINALIZED"))
            .andExpect(jsonPath("$.summary.version").value(2));

        // API and database both protect the finalized source document.
        mvc.perform(put("/api/v1/clinical-reports/"+report)
                .with(user(email(f.practitioner()))).with(csrf())
                .header("X-Clinicflow-Tenant",f.tenant())
                .contentType(MediaType.APPLICATION_JSON)
                .content(reportJson(f.appointment(),2,"Forbidden rewrite")))
            .andExpect(status().isConflict());

        assertThrows(DataAccessException.class,()->jdbc.update("""
            UPDATE clinical_reports SET diagnosis='direct database rewrite'
            WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",f.tenant(),"id",report)));
        assertThrows(DataAccessException.class,()->jdbc.update("""
            DELETE FROM clinical_reports WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",f.tenant(),"id",report)));

        UUID key=UUID.randomUUID();
        String addendum="{\"content\":\"Clarification after final review.\"}";
        mvc.perform(post("/api/v1/clinical-reports/"+report+"/addenda")
                .with(user(email(f.practitioner()))).with(csrf())
                .header("X-Clinicflow-Tenant",f.tenant())
                .header("Idempotency-Key",key)
                .contentType(MediaType.APPLICATION_JSON).content(addendum))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.content").value("Clarification after final review."));

        // Identical retry is idempotent; changed payload with same key is rejected.
        mvc.perform(post("/api/v1/clinical-reports/"+report+"/addenda")
                .with(user(email(f.practitioner()))).with(csrf())
                .header("X-Clinicflow-Tenant",f.tenant())
                .header("Idempotency-Key",key)
                .contentType(MediaType.APPLICATION_JSON).content(addendum))
            .andExpect(status().isCreated());
        assertEquals(1,countAddenda(f.tenant(),report));

        mvc.perform(post("/api/v1/clinical-reports/"+report+"/addenda")
                .with(user(email(f.practitioner()))).with(csrf())
                .header("X-Clinicflow-Tenant",f.tenant())
                .header("Idempotency-Key",key)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Different correction\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("IDEMPOTENCY_KEY_REUSED"));

        UUID addendumId=jdbc.queryForObject("""
            SELECT id FROM clinical_report_addenda
            WHERE tenant_id=:tenant AND report_id=:report
            """,Map.of("tenant",f.tenant(),"report",report),UUID.class);
        assertThrows(DataAccessException.class,()->jdbc.update("""
            UPDATE clinical_report_addenda SET content='rewrite'
            WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",f.tenant(),"id",addendumId)));
    }

    @Test
    void reportRequiresAssignedStartedEncounterAndConcurrentAddendumRetryStaysSingle() throws Exception {
        Fixture f=fixture();

        // Another practitioner in the tenant cannot create a report for this encounter.
        mvc.perform(post("/api/v1/clinical-reports")
                .with(user(email(f.otherPractitioner()))).with(csrf())
                .header("X-Clinicflow-Tenant",f.tenant())
                .contentType(MediaType.APPLICATION_JSON)
                .content(reportJson(f.appointment(),0,"Attempted cross-author report")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("ACTIVE_ASSIGNED_ENCOUNTER_REQUIRED"));

        // Build and finalize an owner report.
        mvc.perform(post("/api/v1/clinical-reports")
                .with(user(email(f.practitioner()))).with(csrf())
                .header("X-Clinicflow-Tenant",f.tenant())
                .contentType(MediaType.APPLICATION_JSON)
                .content(reportJson(f.appointment(),0,"Concurrent correction test")))
            .andExpect(status().isCreated());
        UUID report=jdbc.queryForObject("""
            SELECT id FROM clinical_reports
            WHERE tenant_id=:tenant AND appointment_id=:appointment
            """,Map.of("tenant",f.tenant(),"appointment",f.appointment()),UUID.class);
        mvc.perform(post("/api/v1/clinical-reports/"+report+"/finalize")
                .with(user(email(f.practitioner()))).with(csrf())
                .header("X-Clinicflow-Tenant",f.tenant())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
            .andExpect(status().isOk());

        UUID key=UUID.randomUUID();
        ExecutorService executor=Executors.newFixedThreadPool(2);
        CountDownLatch ready=new CountDownLatch(2),go=new CountDownLatch(1);
        try {
            Callable<Integer> request=()->{
                ready.countDown();
                if(!go.await(5,TimeUnit.SECONDS)) throw new IllegalStateException("race timeout");
                return mvc.perform(post("/api/v1/clinical-reports/"+report+"/addenda")
                        .with(user(email(f.practitioner()))).with(csrf())
                        .header("X-Clinicflow-Tenant",f.tenant())
                        .header("Idempotency-Key",key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Same concurrent correction\"}"))
                    .andReturn().getResponse().getStatus();
            };
            Future<Integer> a=executor.submit(request),b=executor.submit(request);
            assertTrue(ready.await(5,TimeUnit.SECONDS));
            go.countDown();
            assertEquals(201,a.get(15,TimeUnit.SECONDS));
            assertEquals(201,b.get(15,TimeUnit.SECONDS));
            assertEquals(1,countAddenda(f.tenant(),report));
        } finally {
            go.countDown();
            executor.shutdownNow();
        }
    }

    private Fixture fixture() {
        UUID tenant=UUID.randomUUID(),otherTenant=UUID.randomUUID();
        createTenant(tenant); createTenant(otherTenant);
        UUID admin=createUser(tenant,"CLINIC_ADMIN");
        UUID reception=createUser(tenant,"RECEPTION");
        UUID practitioner=createUser(tenant,"PRACTITIONER");
        UUID otherPractitioner=createUser(tenant,"PRACTITIONER");
        UUID intern=createUser(tenant,"INTERN");
        createProfile(tenant,practitioner);
        createProfile(tenant,otherPractitioner);
        UUID patient=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO patients(id,tenant_id,name,date_of_birth,gender)
            VALUES(:id,:tenant,'Clinical Test',:dob,'NOT_DISCLOSED')
            """,Map.of("id",patient,"tenant",tenant,"dob",LocalDate.of(1990,1,1)));
        UUID unit=UUID.randomUUID();
        jdbc.update("INSERT INTO clinic_units(id,tenant_id,name) VALUES(:id,:tenant,'Clinical Unit')",
            Map.of("id",unit,"tenant",tenant));
        UUID service=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO service_definitions(id,tenant_id,name,slug,duration_minutes)
            VALUES(:id,:tenant,'Consultation',:slug,30)
            """,Map.of("id",service,"tenant",tenant,"slug","consult-"+service));
        UUID appointment=UUID.randomUUID();
        LocalDateTime start=LocalDateTime.now().minusHours(1).withSecond(0).withNano(0);
        jdbc.update("""
            INSERT INTO appointments
                (id,tenant_id,patient_id,practitioner_user_id,unit_id,service_id,
                 starts_at,ends_at,status,created_by,idempotency_key,request_hash)
            VALUES(:id,:tenant,:patient,:practitioner,:unit,:service,
                   :start,:end,'IN_PROGRESS',:actor,:key,:hash)
            """,new MapSqlParameterSource()
                .addValue("id",appointment).addValue("tenant",tenant)
                .addValue("patient",patient).addValue("practitioner",practitioner)
                .addValue("unit",unit).addValue("service",service)
                .addValue("start",start).addValue("end",start.plusMinutes(30))
                .addValue("actor",admin).addValue("key",UUID.randomUUID())
                .addValue("hash","a".repeat(64)));
        return new Fixture(tenant,otherTenant,admin,reception,practitioner,
            otherPractitioner,intern,patient,appointment);
    }

    private void createTenant(UUID tenant) {
        jdbc.update("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id",tenant,"name","Clinic "+tenant));
    }
    private UUID createUser(UUID tenant,String role) {
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO users(id,email,display_name,password_hash)
            VALUES(:id,:email,:name,'not-used')
            """,Map.of("id",id,"email",email(id),"name",role+" User"));
        jdbc.update("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:user,:role)
            """,Map.of("tenant",tenant,"user",id,"role",role));
        return id;
    }
    private void createProfile(UUID tenant,UUID user) {
        jdbc.update("""
            INSERT INTO practitioner_profiles(tenant_id,user_id,professional_title)
            VALUES(:tenant,:user,'Doctor')
            """,Map.of("tenant",tenant,"user",user));
    }
    private String reportJson(UUID appointment,long version,String diagnosis) {
        return """
            {"appointmentId":"%s","reportType":"CONSULTATION",
             "symptoms":"Headache","diagnosis":"%s",
             "observations":"Synthetic observation","treatment":"",
             "notes":"","version":%d}
            """.formatted(appointment,diagnosis,version);
    }
    private int countAddenda(UUID tenant,UUID report) {
        Integer value=jdbc.queryForObject("""
            SELECT count(*) FROM clinical_report_addenda
            WHERE tenant_id=:tenant AND report_id=:report
            """,Map.of("tenant",tenant,"report",report),Integer.class);
        return value==null?0:value;
    }
    private String email(UUID id) { return "clinical-"+id+"@example.invalid"; }

    private record Fixture(UUID tenant,UUID otherTenant,UUID admin,UUID reception,
        UUID practitioner,UUID otherPractitioner,UUID intern,UUID patient,UUID appointment) {}
}
