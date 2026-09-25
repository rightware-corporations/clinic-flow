package com.rightware.clinicflow.nursing;

import java.time.*;
import java.util.*;
import java.util.regex.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class NursingOperationsHttpIntegrationTest {
    private static final Pattern TOKEN=Pattern.compile("\\\"token\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    private static final ZoneId MAPUTO=ZoneId.of("Africa/Maputo");

    @Autowired MockMvc mvc;
    @Autowired NamedParameterJdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;

    @Test
    void nurseInviteStartsWithZeroAccessThenAdminAssignmentScopesArrivals() throws Exception {
        UUID tenant=tenant("Nursing Clinic");
        UUID otherTenant=tenant("Foreign Clinic");
        UUID admin=createSyntheticUser(tenant,"CLINIC_ADMIN");
        UUID reception=createSyntheticUser(tenant,"RECEPTION");
        UUID doctor=createSyntheticUser(tenant,"PRACTITIONER");
        UUID foreignAdmin=createSyntheticUser(otherTenant,"CLINIC_ADMIN");
        UUID foreignNurse=createSyntheticUser(otherTenant,"NURSE");
        nursingProfile(otherTenant,foreignNurse);

        UUID assignedUnit=unit(tenant,"Assigned Unit",true);
        UUID hiddenUnit=unit(tenant,"Hidden Unit",true);
        UUID inactiveUnit=unit(tenant,"Inactive Unit",false);
        UUID foreignUnit=unit(otherTenant,"Foreign Unit",true);
        UUID service=service(tenant);
        practitionerProfile(tenant,doctor);

        String nurseEmail="nurse-"+UUID.randomUUID()+"@example.invalid";
        var invite=mvc.perform(post("/api/v1/admin/invitations")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"%s","displayName":"Synthetic Nurse","role":"NURSE"}
                    """.formatted(nurseEmail)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.role").value("NURSE"))
            .andReturn();
        String token=extractToken(invite.getResponse().getContentAsString());

        mvc.perform(post("/api/v1/auth/invitations/current/accept").with(csrf())
                .header("X-Clinicflow-Invitation",token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"Synthetic-Nurse-Password-2026\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.role").value("NURSE"));

        UUID nurse=jdbc.queryForObject("""
            SELECT u.id FROM users u
            JOIN tenant_memberships m ON m.user_id=u.id
            WHERE m.tenant_id=:tenant AND lower(u.email)=lower(:email)
              AND m.role='NURSE' AND m.active
            """,Map.of("tenant",tenant,"email",nurseEmail),UUID.class);
        assertNotNull(nurse);
        assertEquals(1,jdbc.queryForObject("""
            SELECT count(*) FROM nursing_profiles
            WHERE tenant_id=:tenant AND user_id=:nurse
            """,Map.of("tenant",tenant,"nurse",nurse),Integer.class));

        mvc.perform(get("/api/v1/nursing/units").with(user(nurseEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));

        LocalDate today=LocalDate.now(MAPUTO);
        UUID visibleAppointment=appointment(tenant,doctor,admin,assignedUnit,service,today.atTime(9,0));
        UUID hiddenAppointment=appointment(tenant,doctor,admin,hiddenUnit,service,today.atTime(10,0));
        checkIn(tenant,visibleAppointment,reception);
        checkIn(tenant,hiddenAppointment,reception);

        mvc.perform(get("/api/v1/nursing/arrivals").with(user(nurseEmail))
                .header("X-Clinicflow-Tenant",tenant)
                .param("date",today.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));

        mvc.perform(put("/api/v1/admin/nursing-team/"+nurse+"/units")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"version":0,"unitIds":["%s"]}
                    """.formatted(assignedUnit)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value(1))
            .andExpect(jsonPath("$.units[0].id").value(assignedUnit.toString()));

        mvc.perform(get("/api/v1/nursing/arrivals").with(user(nurseEmail))
                .header("X-Clinicflow-Tenant",tenant)
                .param("date",today.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].appointmentId").value(visibleAppointment.toString()))
            .andExpect(jsonPath("$[0].unitId").value(assignedUnit.toString()))
            .andExpect(jsonPath("$[0].patientName").value("Synthetic Patient"))
            .andExpect(jsonPath("$[0].diagnosis").doesNotExist());

        mvc.perform(put("/api/v1/admin/nursing-team/"+nurse+"/units")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"version":0,"unitIds":["%s"]}
                    """.formatted(hiddenUnit)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("STALE_NURSING_ASSIGNMENT"));

        mvc.perform(put("/api/v1/admin/nursing-team/"+nurse+"/units")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"version":1,"unitIds":["%s"]}
                    """.formatted(foreignUnit)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("ACTIVE_TENANT_UNITS_REQUIRED"));

        mvc.perform(put("/api/v1/admin/nursing-team/"+nurse+"/units")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"version":1,"unitIds":["%s"]}
                    """.formatted(inactiveUnit)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("ACTIVE_TENANT_UNITS_REQUIRED"));

        mvc.perform(put("/api/v1/admin/nursing-team/"+nurse+"/units")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"version":1,"unitIds":["%s","%s"]}
                    """.formatted(assignedUnit,assignedUnit)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("DUPLICATE_UNIT_ASSIGNMENT"));

        mvc.perform(get("/api/v1/nursing/arrivals").with(user(email(foreignNurse)))
                .header("X-Clinicflow-Tenant",tenant)
                .param("date",today.toString()))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/nursing/arrivals").with(user(email(reception)))
                .header("X-Clinicflow-Tenant",tenant)
                .param("date",today.toString()))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/clinical-reports").with(user(nurseEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/admin/nursing-team").with(user(nurseEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/admin/nursing-team").with(user(email(foreignAdmin)))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isForbidden());

        assertTrue(jdbc.queryForObject("""
            SELECT count(*) FROM audit_events
            WHERE tenant_id=:tenant AND action='NURSING_UNITS_UPDATED'
              AND resource_id=:nurse
            """,Map.of("tenant",tenant,"nurse",nurse),Integer.class)>=1);
        assertTrue(jdbc.queryForObject("""
            SELECT count(*) FROM audit_events
            WHERE tenant_id=:tenant AND action='NURSING_ARRIVALS_VIEWED'
              AND actor_id=:nurse
            """,Map.of("tenant",tenant,"nurse",nurse),Integer.class)>=2);
    }

    @Test
    void assignmentMutationRequiresCsrfAndClinicAdmin() throws Exception {
        UUID tenant=tenant("Nursing Security");
        UUID admin=createSyntheticUser(tenant,"CLINIC_ADMIN");
        UUID nurse=createSyntheticUser(tenant,"NURSE");
        nursingProfile(tenant,nurse);
        UUID target=unit(tenant,"Target",true);

        mvc.perform(put("/api/v1/admin/nursing-team/"+nurse+"/units")
                .with(user(email(admin)))
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"version":0,"unitIds":["%s"]}
                    """.formatted(target)))
            .andExpect(status().isForbidden());

        mvc.perform(put("/api/v1/admin/nursing-team/"+nurse+"/units")
                .with(user(email(nurse))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"version":0,"unitIds":["%s"]}
                    """.formatted(target)))
            .andExpect(status().isForbidden());

        assertEquals(0,jdbc.queryForObject("""
            SELECT count(*) FROM nursing_unit_assignments
            WHERE tenant_id=:tenant AND nurse_user_id=:nurse
            """,Map.of("tenant",tenant,"nurse",nurse),Integer.class));
    }

    private UUID tenant(String name){
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO organizations(id,name) VALUES(:id,:name)",Map.of("id",id,"name",name));
        return id;
    }
    private UUID createSyntheticUser(UUID tenant,String role){
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO users(id,email,display_name,password_hash)
            VALUES(:id,:email,:name,:hash)
            """,Map.of("id",id,"email","nursing-"+id+"@example.invalid",
                "name",role,"hash",encoder.encode("Synthetic-Password-2026")));
        jdbc.update("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:id,:role)
            """,Map.of("tenant",tenant,"id",id,"role",role));
        return id;
    }
    private void nursingProfile(UUID tenant,UUID user){
        jdbc.update("""
            INSERT INTO nursing_profiles(tenant_id,user_id) VALUES(:tenant,:user)
            """,Map.of("tenant",tenant,"user",user));
    }
    private UUID unit(UUID tenant,String name,boolean active){
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO clinic_units(id,tenant_id,name,active)
            VALUES(:id,:tenant,:name,:active)
            """,Map.of("id",id,"tenant",tenant,"name",name,"active",active));
        return id;
    }
    private UUID service(UUID tenant){
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO service_definitions(id,tenant_id,name,slug,duration_minutes)
            VALUES(:id,:tenant,'General',:slug,30)
            """,Map.of("id",id,"tenant",tenant,"slug","nursing-"+id));
        return id;
    }
    private void practitionerProfile(UUID tenant,UUID doctor){
        jdbc.update("""
            INSERT INTO practitioner_profiles(tenant_id,user_id,professional_title)
            VALUES(:tenant,:doctor,'Doctor')
            """,Map.of("tenant",tenant,"doctor",doctor));
    }
    private UUID appointment(UUID tenant,UUID doctor,UUID creator,UUID unit,UUID service,
                             LocalDateTime starts){
        UUID patient=UUID.randomUUID(),id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO patients(id,tenant_id,name,date_of_birth,gender)
            VALUES(:id,:tenant,'Synthetic Patient','1990-01-01','F')
            """,Map.of("id",patient,"tenant",tenant));
        jdbc.update("""
            INSERT INTO appointments(id,tenant_id,patient_id,practitioner_user_id,
              unit_id,service_id,starts_at,ends_at,status,created_by,idempotency_key,request_hash)
            VALUES(:id,:tenant,:patient,:doctor,:unit,:service,:start,:end,
              'CONFIRMED',:creator,:key,:hash)
            """,new MapSqlParameterSource().addValue("id",id).addValue("tenant",tenant)
            .addValue("patient",patient).addValue("doctor",doctor).addValue("unit",unit)
            .addValue("service",service).addValue("start",starts).addValue("end",starts.plusMinutes(30))
            .addValue("creator",creator).addValue("key",UUID.randomUUID()).addValue("hash","0".repeat(64)));
        return id;
    }
    private void checkIn(UUID tenant,UUID appointment,UUID reception){
        jdbc.update("""
            INSERT INTO reception_checkins(tenant_id,id,appointment_id,checked_in_by)
            VALUES(:tenant,:id,:appointment,:reception)
            """,Map.of("tenant",tenant,"id",UUID.randomUUID(),"appointment",appointment,"reception",reception));
    }
    private String email(UUID user){
        return jdbc.queryForObject("SELECT email FROM users WHERE id=:id",Map.of("id",user),String.class);
    }
    private String extractToken(String body){
        var matcher=TOKEN.matcher(body);
        assertTrue(matcher.find(),"Invitation response must include token");
        return matcher.group(1);
    }
}
