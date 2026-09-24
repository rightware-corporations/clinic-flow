package com.rightware.clinicflow.patients;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class PatientCrudHttpIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired NamedParameterJdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;

    @Test
    void clinicAdminCanCrudButCannotCrossTenantAndStaleUpdateConflicts() throws Exception {
        Fixture f = fixture("CLINIC_ADMIN");
        MockHttpSession session = login(f.email(), f.password());

        String payload = """
            {"name":"Maria Teste","dateOfBirth":"1990-04-10","gender":"F",
             "phone":"+258840000001","email":"maria@example.invalid",
             "address":"Maputo","nationalId":"DOC-1","healthNumber":"H-1"}
            """;
        var created = mvc.perform(post("/api/v1/patients").session(session).with(csrf())
                .header("X-Clinicflow-Tenant", f.tenantA()).contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Maria Teste"))
            .andExpect(jsonPath("$.version").value(0))
            .andReturn().getResponse().getContentAsString();

        String id = new com.fasterxml.jackson.databind.ObjectMapper()
            .readTree(created).get("id").asText();

        mvc.perform(get("/api/v1/patients").session(session)
                .header("X-Clinicflow-Tenant", f.tenantA()).param("query", "Maria"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
            .andExpect(jsonPath("$.items[0].id").value(id));

        mvc.perform(get("/api/v1/patients/" + id).session(session)
                .header("X-Clinicflow-Tenant", f.tenantB()))
            .andExpect(status().isForbidden());

        String update = """
            {"name":"Maria Actualizada","dateOfBirth":"1990-04-10","gender":"F",
             "phone":"+258840000001","email":"maria@example.invalid",
             "address":"Maputo","nationalId":"DOC-1","healthNumber":"H-1","version":0}
            """;
        mvc.perform(put("/api/v1/patients/" + id).session(session).with(csrf())
                .header("X-Clinicflow-Tenant", f.tenantA()).contentType(MediaType.APPLICATION_JSON)
                .content(update))
            .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1))
            .andExpect(jsonPath("$.name").value("Maria Actualizada"));

        mvc.perform(put("/api/v1/patients/" + id).session(session).with(csrf())
                .header("X-Clinicflow-Tenant", f.tenantA()).contentType(MediaType.APPLICATION_JSON)
                .content(update))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("STALE_PATIENT_VERSION"));

        mvc.perform(post("/api/v1/patients/" + id + "/archive").session(session).with(csrf())
                .header("X-Clinicflow-Tenant", f.tenantA()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":1}"))
            .andExpect(status().isOk());

        mvc.perform(get("/api/v1/patients/" + id).session(session)
                .header("X-Clinicflow-Tenant", f.tenantA()))
            .andExpect(status().isNotFound());
    }

    @Test
    void practitionerCannotReadRegistryUntilCareRelationshipExists() throws Exception {
        Fixture f = fixture("PRACTITIONER");
        MockHttpSession session = login(f.email(), f.password());
        mvc.perform(get("/api/v1/patients").session(session)
                .header("X-Clinicflow-Tenant", f.tenantA()))
            .andExpect(status().isForbidden());
    }

    private MockHttpSession login(String email, String password) throws Exception {
        var result = mvc.perform(post("/api/v1/auth/login").with(csrf())
                .param("email", email).param("password", password))
            .andExpect(status().isOk()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private Fixture fixture(String role) {
        UUID a = UUID.randomUUID(), b = UUID.randomUUID(), user = UUID.randomUUID();
        String email = "patient-crud-" + user + "@example.invalid";
        String password = "Integration-Test-Secret-2026";
        jdbc.update("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id", a, "name", "Patient Clinic A"));
        jdbc.update("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id", b, "name", "Patient Clinic B"));
        jdbc.update("""
            INSERT INTO users(id,email,display_name,password_hash)
            VALUES(:id,:email,:name,:hash)
            """, Map.of("id", user, "email", email, "name", "Patient Test User",
                "hash", encoder.encode(password)));
        jdbc.update("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:user,:role)
            """, Map.of("tenant", a, "user", user, "role", role));
        return new Fixture(a, b, email, password);
    }

    record Fixture(UUID tenantA, UUID tenantB, String email, String password) {}
}
