package com.rightware.clinicflow.security;

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

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SessionAndTenantHttpIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired NamedParameterJdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;

    @Test
    void loginChecksPasswordAndTenantScopesBeforeCrud() throws Exception {
        UUID tenantA = UUID.randomUUID();
        UUID tenantB = UUID.randomUUID();
        UUID admin = UUID.randomUUID();
        String email = "http-" + admin + "@example.invalid";
        String password = "Integration-Test-Secret-2026";

        jdbc.update("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id", tenantA, "name", "Authorized Clinic"));
        jdbc.update("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id", tenantB, "name", "Other Clinic"));
        jdbc.update("""
            INSERT INTO users(id,email,display_name,password_hash)
            VALUES(:id,:email,:name,:hash)
            """, Map.of("id", admin, "email", email, "name", "Test Admin",
                "hash", encoder.encode(password)));
        jdbc.update("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:user,'CLINIC_ADMIN')
            """, Map.of("tenant", tenantA, "user", admin));

        mvc.perform(post("/api/v1/auth/login").with(csrf())
                .param("email", email).param("password", "incorrect"))
            .andExpect(status().isUnauthorized());
        var authResult = mvc.perform(post("/api/v1/auth/login").with(csrf())
                .param("email", email).param("password", password))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.authenticated").value(true)).andReturn();
        MockHttpSession session = (MockHttpSession) authResult.getRequest().getSession(false);
        assertNotNull(session, "Successful login must create a server-side session");

        mvc.perform(get("/api/v1/me").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.memberships[0].tenantId").value(tenantA.toString()));

        mvc.perform(get("/api/v1/clinic-units").session(session)
                .header("X-Clinicflow-Tenant", tenantB.toString()))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/clinic-units").session(session)
                .header("X-Clinicflow-Tenant", tenantA.toString())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"No CSRF\"}"))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/clinic-units").session(session).with(csrf())
                .header("X-Clinicflow-Tenant", tenantA.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Authorized Unit\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Authorized Unit"));

        mvc.perform(post("/api/v1/clinic-units").session(session).with(csrf())
                .header("X-Clinicflow-Tenant", tenantB.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Cross Tenant Unit\"}"))
            .andExpect(status().isForbidden());
    }
}
