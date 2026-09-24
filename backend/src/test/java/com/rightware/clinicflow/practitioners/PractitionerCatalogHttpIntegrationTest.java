package com.rightware.clinicflow.practitioners;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class PractitionerCatalogHttpIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired NamedParameterJdbcTemplate jdbc;

    @Test
    void adminBuildsProfessionalCatalogWithoutCrossTenantAssignments() throws Exception {
        UUID tenant = UUID.randomUUID(), other = UUID.randomUUID();
        UUID admin = createUser(tenant, "CLINIC_ADMIN");
        UUID practitioner = createUser(tenant, "PRACTITIONER");
        UUID otherPractitioner = createUser(other, "PRACTITIONER");
        UUID unit = unit(tenant, "Central");
        UUID otherUnit = unit(other, "Other");
        UUID service = service(tenant, "consulta-geral");

        String adminEmail = email(admin);
        var specialtyResult = mvc.perform(post("/api/v1/specialties").with(user(adminEmail)).with(csrf())
                .header("X-Clinicflow-Tenant", tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Medicina Geral\",\"code\":\"medicina-geral\"}"))
            .andExpect(status().isCreated()).andReturn();
        UUID specialty = jdbc.queryForObject("""
            SELECT id FROM specialties WHERE tenant_id=:tenant AND code='medicina-geral'
            """, Map.of("tenant", tenant), UUID.class);

        String create = """
            {"userId":"%s","specialtyId":"%s","professionalTitle":"Médico",
             "licenseNumber":"LIC-001","bio":"Perfil de teste",
             "unitIds":["%s"],"serviceIds":["%s"]}
            """.formatted(practitioner, specialty, unit, service);
        mvc.perform(post("/api/v1/practitioners").with(user(adminEmail)).with(csrf())
                .header("X-Clinicflow-Tenant", tenant)
                .contentType(MediaType.APPLICATION_JSON).content(create))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.userId").value(practitioner.toString()))
            .andExpect(jsonPath("$.version").value(0))
            .andExpect(jsonPath("$.unitIds[0]").value(unit.toString()));

        String invalidCrossTenant = """
            {"userId":"%s","professionalTitle":"Médico",
             "unitIds":["%s"],"serviceIds":[],"version":0}
            """.formatted(practitioner, otherUnit);
        mvc.perform(put("/api/v1/practitioners/" + practitioner)
                .with(user(adminEmail)).with(csrf())
                .header("X-Clinicflow-Tenant", tenant)
                .contentType(MediaType.APPLICATION_JSON).content(invalidCrossTenant))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("INVALID_CLINIC_UNIT"));

        String wrongTenantUser = """
            {"userId":"%s","professionalTitle":"Médico","unitIds":[],"serviceIds":[]}
            """.formatted(otherPractitioner);
        mvc.perform(post("/api/v1/practitioners").with(user(adminEmail)).with(csrf())
                .header("X-Clinicflow-Tenant", tenant)
                .contentType(MediaType.APPLICATION_JSON).content(wrongTenantUser))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("PRACTITIONER_MEMBERSHIP_REQUIRED"));

        mvc.perform(get("/api/v1/practitioners").with(user(adminEmail))
                .header("X-Clinicflow-Tenant", tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].userId").value(practitioner.toString()));
    }

    private UUID createUser(UUID tenant, String role) {
        ensureTenant(tenant);
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO users(id,email,display_name,password_hash)
            VALUES(:id,:email,:name,'unused-test-hash')
            """, Map.of("id", id, "email", email(id), "name", role + " Test"));
        jdbc.update("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:user,:role)
            """, Map.of("tenant", tenant, "user", id, "role", role));
        return id;
    }

    private UUID unit(UUID tenant, String name) {
        ensureTenant(tenant);
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO clinic_units(id,tenant_id,name) VALUES(:id,:tenant,:name)
            """, Map.of("id", id, "tenant", tenant, "name", name + id));
        return id;
    }

    private UUID service(UUID tenant, String slug) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO service_definitions(id,tenant_id,name,slug,duration_minutes)
            VALUES(:id,:tenant,'Service',:slug,30)
            """, Map.of("id", id, "tenant", tenant, "slug", slug + "-" + id));
        return id;
    }

    private void ensureTenant(UUID tenant) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM organizations WHERE id=:id",
            Map.of("id", tenant), Integer.class);
        if (n != null && n == 0) {
            jdbc.update("INSERT INTO organizations(id,name) VALUES(:id,:name)",
                Map.of("id", tenant, "name", "Clinic " + tenant));
        }
    }

    private String email(UUID id) { return "catalog-" + id + "@example.invalid"; }
}
