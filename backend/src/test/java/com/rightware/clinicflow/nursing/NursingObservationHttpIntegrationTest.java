package com.rightware.clinicflow.nursing;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class NursingObservationHttpIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired NamedParameterJdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;

    @Test
    void observationRequiresCheckinAssignmentAndPreservesSubmittedContent() throws Exception {
        UUID tenant=tenant("N02 Clinic");
        UUID admin=user(tenant,"CLINIC_ADMIN");
        UUID reception=user(tenant,"RECEPTION");
        UUID nurse=user(tenant,"NURSE");
        UUID otherNurse=user(tenant,"NURSE");
        UUID doctor=user(tenant,"PRACTITIONER");
        UUID otherDoctor=user(tenant,"PRACTITIONER");
        nursingProfile(tenant,nurse);
        nursingProfile(tenant,otherNurse);
        practitionerProfile(tenant,doctor);
        practitionerProfile(tenant,otherDoctor);
        UUID unit=unit(tenant,"N02 Unit");
        UUID otherUnit=unit(tenant,"Other Unit");
        assign(tenant,nurse,unit);
        assign(tenant,otherNurse,unit);
        UUID service=service(tenant);
        UUID appointment=appointment(tenant,doctor,admin,unit,service,LocalDateTime.of(2026,9,25,11,0));

        String nurseEmail=email(nurse);
        String otherNurseEmail=email(otherNurse);
        String doctorEmail=email(doctor);
        String otherDoctorEmail=email(otherDoctor);

        mvc.perform(post("/api/v1/nursing/observations")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nurseEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"appointmentId":"%s","presentingConcern":"Dor referida"}
                    """.formatted(appointment)))
            .andExpect(status().isNotFound());

        checkIn(tenant,appointment,reception);

        mvc.perform(post("/api/v1/nursing/observations")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nurseEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"appointmentId":"%s","presentingConcern":"Dor referida",
                     "measurements":{"heartRate":80}}
                    """.formatted(appointment)))
            .andExpect(status().isBadRequest());

        mvc.perform(post("/api/v1/nursing/observations")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nurseEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"appointmentId":"%s","presentingConcern":"Dor referida",
                     "observationNotes":"Paciente consciente durante o registo.",
                     "measurements":{"temperatureC":36.50,"heartRate":80,
                     "respiratoryRate":18,"spo2Percent":98,
                     "systolicMmhg":120,"diastolicMmhg":80},
                     "measuredAt":"2026-09-25T11:05:00+02:00"}
                    """.formatted(appointment)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andExpect(jsonPath("$.version").value(0))
            .andExpect(jsonPath("$.measurements.heartRate").value(80))
            .andExpect(jsonPath("$.measurements.spo2Percent").value(98));

        mvc.perform(get("/api/v1/nursing/observations/"+appointment)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(otherNurseEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isNotFound());

        mvc.perform(get("/api/v1/practitioner/nursing-observations/"+appointment)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(doctorEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isNotFound());

        mvc.perform(put("/api/v1/nursing/observations/"+appointment)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nurseEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"version":0,"presentingConcern":"Dor referida",
                     "observationNotes":"Observação revista sem classificação automática.",
                     "measurements":{"temperatureC":36.50,"heartRate":80,
                     "respiratoryRate":18,"spo2Percent":98,
                     "systolicMmhg":120,"diastolicMmhg":80},
                     "measuredAt":"2026-09-25T11:05:00+02:00"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value(1));

        mvc.perform(put("/api/v1/nursing/observations/"+appointment)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nurseEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"version":0,"presentingConcern":"stale"}
                    """))
            .andExpect(status().isConflict());

        mvc.perform(post("/api/v1/nursing/observations/"+appointment+"/submit")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nurseEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":1}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUBMITTED"))
            .andExpect(jsonPath("$.version").value(2));

        String contentBefore=jdbc.queryForObject("""
            SELECT observation_notes FROM nursing_observations
            WHERE tenant_id=:tenant AND appointment_id=:appointment
            """,Map.of("tenant",tenant,"appointment",appointment),String.class);

        assertThrows(DataAccessException.class,()->jdbc.update("""
            UPDATE nursing_observations SET observation_notes='tampered'
            WHERE tenant_id=:tenant AND appointment_id=:appointment
            """,Map.of("tenant",tenant,"appointment",appointment)));

        assertEquals(contentBefore,jdbc.queryForObject("""
            SELECT observation_notes FROM nursing_observations
            WHERE tenant_id=:tenant AND appointment_id=:appointment
            """,Map.of("tenant",tenant,"appointment",appointment),String.class));

        mvc.perform(get("/api/v1/practitioner/nursing-observations/"+appointment)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(otherDoctorEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isNotFound());

        mvc.perform(get("/api/v1/practitioner/nursing-observations/"+appointment)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(doctorEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUBMITTED"))
            .andExpect(jsonPath("$.observationNotes").value(contentBefore));

        mvc.perform(post("/api/v1/practitioner/nursing-observations/"+appointment+"/acknowledge")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(doctorEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACKNOWLEDGED"))
            .andExpect(jsonPath("$.version").value(3))
            .andExpect(jsonPath("$.observationNotes").value(contentBefore));

        mvc.perform(post("/api/v1/practitioner/nursing-observations/"+appointment+"/acknowledge")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(doctorEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACKNOWLEDGED"))
            .andExpect(jsonPath("$.version").value(3));

        jdbc.update("""
            UPDATE appointments SET status='COMPLETED'
            WHERE tenant_id=:tenant AND id=:appointment
            """,Map.of("tenant",tenant,"appointment",appointment));

        mvc.perform(get("/api/v1/nursing/observations/"+appointment)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nurseEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACKNOWLEDGED"))
            .andExpect(jsonPath("$.observationNotes").value(contentBefore));

        mvc.perform(put("/api/v1/nursing/observations/"+appointment)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nurseEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"version":3,"observationNotes":"overwrite attempted"}
                    """))
            .andExpect(status().isNotFound());

        jdbc.update("""
            DELETE FROM nursing_unit_assignments
            WHERE tenant_id=:tenant AND nurse_user_id=:nurse AND unit_id=:unit
            """,Map.of("tenant",tenant,"nurse",nurse,"unit",unit));

        mvc.perform(get("/api/v1/nursing/observations/"+appointment)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nurseEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isNotFound());

        assertTrue(jdbc.queryForObject("""
            SELECT count(*) FROM nursing_observation_events
            WHERE tenant_id=:tenant AND observation_id=(
              SELECT id FROM nursing_observations
              WHERE tenant_id=:tenant AND appointment_id=:appointment)
            """,Map.of("tenant",tenant,"appointment",appointment),Integer.class)>=4);
        assertTrue(jdbc.queryForObject("""
            SELECT count(*) FROM audit_events
            WHERE tenant_id=:tenant AND action='NURSING_OBSERVATION_SUBMITTED'
            """,Map.of("tenant",tenant),Integer.class)>=1);

        // Ensure an unrelated unit never became part of the authorization relationship.
        assertEquals(0,jdbc.queryForObject("""
            SELECT count(*) FROM nursing_unit_assignments
            WHERE tenant_id=:tenant AND nurse_user_id=:nurse AND unit_id=:other
            """,Map.of("tenant",tenant,"nurse",nurse,"other",otherUnit),Integer.class));
    }

    @Test
    void clinicalObservationEndpointsRejectWrongRolesForeignTenantAndMissingCsrf() throws Exception {
        UUID tenant=tenant("N02 Security");
        UUID foreign=tenant("N02 Foreign");
        UUID admin=user(tenant,"CLINIC_ADMIN");
        UUID reception=user(tenant,"RECEPTION");
        UUID nurse=user(tenant,"NURSE");
        UUID foreignNurse=user(foreign,"NURSE");
        UUID doctor=user(tenant,"PRACTITIONER");
        nursingProfile(tenant,nurse);
        nursingProfile(foreign,foreignNurse);
        practitionerProfile(tenant,doctor);
        UUID unit=unit(tenant,"Security Unit");
        assign(tenant,nurse,unit);
        UUID service=service(tenant);
        UUID appointment=appointment(tenant,doctor,admin,unit,service,LocalDateTime.of(2026,9,25,13,0));
        checkIn(tenant,appointment,reception);

        mvc.perform(post("/api/v1/nursing/observations")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(email(nurse)))
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"appointmentId":"%s","presentingConcern":"Synthetic"}
                    """.formatted(appointment)))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/nursing/observations")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(email(admin)))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"appointmentId":"%s","presentingConcern":"Synthetic"}
                    """.formatted(appointment)))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/nursing/observations")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(email(foreignNurse)))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"appointmentId":"%s","presentingConcern":"Synthetic"}
                    """.formatted(appointment)))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/practitioner/nursing-observations/"+appointment)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(email(reception)))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isForbidden());

        assertEquals(0,jdbc.queryForObject("""
            SELECT count(*) FROM nursing_observations WHERE tenant_id=:tenant
            """,Map.of("tenant",tenant),Integer.class));
    }

    @Test
    void n03HistoryAndImmutableCorrectionsRequireCurrentCareRelationship() throws Exception {
        UUID tenant=tenant("N03 Continuity");
        UUID foreign=tenant("N03 Foreign");
        UUID admin=user(tenant,"CLINIC_ADMIN");
        UUID reception=user(tenant,"RECEPTION");
        UUID nurse=user(tenant,"NURSE");
        UUID otherNurse=user(tenant,"NURSE");
        UUID foreignNurse=user(foreign,"NURSE");
        UUID doctor=user(tenant,"PRACTITIONER");
        UUID otherDoctor=user(tenant,"PRACTITIONER");
        nursingProfile(tenant,nurse);
        nursingProfile(tenant,otherNurse);
        nursingProfile(foreign,foreignNurse);
        practitionerProfile(tenant,doctor);
        practitionerProfile(tenant,otherDoctor);
        UUID unit=unit(tenant,"N03 assigned unit");
        assign(tenant,nurse,unit);
        assign(tenant,otherNurse,unit);
        UUID service=service(tenant);
        UUID appointment=appointment(tenant,doctor,admin,unit,service,
            LocalDateTime.of(2026,9,24,10,0));
        checkIn(tenant,appointment,reception);
        String nEmail=email(nurse);
        String dEmail=email(doctor);
        String originalText="Sintético: observação original";
        String correctionText="Correcção sintética: esclarecer informação registada";
        UUID key=UUID.randomUUID();

        mvc.perform(post("/api/v1/nursing/observations")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"appointmentId":"%s","observationNotes":"%s"}
                    """.formatted(appointment,originalText)))
            .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/nursing/observations/"+appointment+"/submit")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUBMITTED"));

        jdbc.update("""
            UPDATE appointments SET status='COMPLETED'
            WHERE tenant_id=:tenant AND id=:appointment
            """,Map.of("tenant",tenant,"appointment",appointment));

        mvc.perform(get("/api/v1/nursing/observations/history").param("page","0")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(1))
            .andExpect(jsonPath("$.items[0].appointmentId").value(appointment.toString()))
            .andExpect(jsonPath("$.items[0].correctionCount").value(0))
            .andExpect(jsonPath("$.items[0].observationNotes").doesNotExist());

        mvc.perform(get("/api/v1/nursing/observations/history/"+appointment)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUBMITTED"));

        mvc.perform(get("/api/v1/nursing/observations/history")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(email(otherNurse)))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));

        mvc.perform(get("/api/v1/nursing/observations/history")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(email(admin)))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/nursing/observations/history")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(email(foreignNurse)))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/nursing/observations/history").param("page","1001")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isBadRequest());

        mvc.perform(post("/api/v1/nursing/observations/"+appointment+"/addenda")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nEmail))
                .header("X-Clinicflow-Tenant",tenant)
                .header("Idempotency-Key",key).contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"content":"%s"}
                    """.formatted(correctionText)))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/nursing/observations/"+appointment+"/addenda")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .header("Idempotency-Key",UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"   \"}"))
            .andExpect(status().isBadRequest());

        var first=mvc.perform(post("/api/v1/nursing/observations/"+appointment+"/addenda")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .header("Idempotency-Key",key).contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"content":"%s"}
                    """.formatted(correctionText)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.content").value(correctionText))
            .andExpect(jsonPath("$.acknowledgedAt").isEmpty())
            .andReturn();

        var idMatcher=java.util.regex.Pattern.compile(
            "\"id\"\\s*:\\s*\"([^\"]+)\"")
            .matcher(first.getResponse().getContentAsString());
        assertTrue(idMatcher.find());
        UUID correctionId=UUID.fromString(idMatcher.group(1));

        mvc.perform(post("/api/v1/nursing/observations/"+appointment+"/addenda")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .header("Idempotency-Key",key).contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"content":"%s"}
                    """.formatted(correctionText)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(correctionId.toString()));

        mvc.perform(post("/api/v1/nursing/observations/"+appointment+"/addenda")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant)
                .header("Idempotency-Key",key).contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"different correction\"}"))
            .andExpect(status().isConflict());

        mvc.perform(get("/api/v1/nursing/observations/"+appointment+"/addenda")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(email(otherNurse)))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isNotFound());

        mvc.perform(get("/api/v1/practitioner/nursing-observations/"+appointment+"/addenda")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(email(otherDoctor)))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isNotFound());

        mvc.perform(post("/api/v1/practitioner/nursing-observations/"+appointment+"/acknowledge")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(dEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACKNOWLEDGED"));

        mvc.perform(get("/api/v1/practitioner/nursing-observations/"+appointment+"/addenda")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(dEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(1))
            .andExpect(jsonPath("$.items[0].acknowledgedAt").isEmpty());

        assertThrows(DataAccessException.class,()->jdbc.update("""
            UPDATE nursing_observation_addenda SET content='overwritten'
            WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",tenant,"id",correctionId)));
        assertThrows(DataAccessException.class,()->jdbc.update("""
            DELETE FROM nursing_observation_addenda
            WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",tenant,"id",correctionId)));

        String receipt="/api/v1/practitioner/nursing-observations/"
            +appointment+"/addenda/"+correctionId+"/acknowledge";
        mvc.perform(post(receipt)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(dEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.acknowledgedBy").value(doctor.toString()));
        mvc.perform(post(receipt)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(dEmail))
                .with(csrf()).header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.acknowledgedBy").value(doctor.toString()));

        assertEquals(1,jdbc.queryForObject("""
            SELECT count(*) FROM nursing_observation_addenda
            WHERE tenant_id=:tenant AND observation_id=(
              SELECT id FROM nursing_observations
              WHERE tenant_id=:tenant AND appointment_id=:appointment)
            """,Map.of("tenant",tenant,"appointment",appointment),Integer.class));

        mvc.perform(get("/api/v1/nursing/observations/history")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].correctionCount").value(1));

        jdbc.update("""
            DELETE FROM nursing_unit_assignments
            WHERE tenant_id=:tenant AND nurse_user_id=:nurse AND unit_id=:unit
            """,Map.of("tenant",tenant,"nurse",nurse,"unit",unit));

        mvc.perform(get("/api/v1/nursing/observations/history")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/api/v1/nursing/observations/"+appointment+"/addenda")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(nEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/practitioner/nursing-observations/"+appointment+"/addenda")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(dEmail))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
    }

    private UUID tenant(String name){
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO organizations(id,name) VALUES(:id,:name)",Map.of("id",id,"name",name));
        return id;
    }

    private UUID user(UUID tenant,String role){
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO users(id,email,display_name,password_hash)
            VALUES(:id,:email,:name,:hash)
            """,Map.of("id",id,"email","n02-"+id+"@example.invalid",
                "name",role,"hash",encoder.encode("Synthetic-Password-2026")));
        jdbc.update("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:id,:role)
            """,Map.of("tenant",tenant,"id",id,"role",role));
        return id;
    }

    private void nursingProfile(UUID tenant,UUID nurse){
        jdbc.update("INSERT INTO nursing_profiles(tenant_id,user_id) VALUES(:tenant,:user)",
            Map.of("tenant",tenant,"user",nurse));
    }

    private void practitionerProfile(UUID tenant,UUID doctor){
        jdbc.update("""
            INSERT INTO practitioner_profiles(tenant_id,user_id,professional_title)
            VALUES(:tenant,:doctor,'Doctor')
            """,Map.of("tenant",tenant,"doctor",doctor));
    }

    private UUID unit(UUID tenant,String name){
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO clinic_units(id,tenant_id,name,active)
            VALUES(:id,:tenant,:name,true)
            """,Map.of("id",id,"tenant",tenant,"name",name));
        return id;
    }

    private void assign(UUID tenant,UUID nurse,UUID unit){
        jdbc.update("""
            INSERT INTO nursing_unit_assignments(tenant_id,nurse_user_id,unit_id)
            VALUES(:tenant,:nurse,:unit)
            """,Map.of("tenant",tenant,"nurse",nurse,"unit",unit));
    }

    private UUID service(UUID tenant){
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO service_definitions(id,tenant_id,name,slug,duration_minutes)
            VALUES(:id,:tenant,'General',:slug,30)
            """,Map.of("id",id,"tenant",tenant,"slug","n02-"+id));
        return id;
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
            .addValue("creator",creator).addValue("key",UUID.randomUUID())
            .addValue("hash","0".repeat(64)));
        return id;
    }

    private void checkIn(UUID tenant,UUID appointment,UUID reception){
        jdbc.update("""
            INSERT INTO reception_checkins(tenant_id,id,appointment_id,checked_in_by)
            VALUES(:tenant,:id,:appointment,:reception)
            """,Map.of("tenant",tenant,"id",UUID.randomUUID(),
                "appointment",appointment,"reception",reception));
    }

    private String email(UUID user){
        return jdbc.queryForObject("SELECT email FROM users WHERE id=:id",
            Map.of("id",user),String.class);
    }
}
