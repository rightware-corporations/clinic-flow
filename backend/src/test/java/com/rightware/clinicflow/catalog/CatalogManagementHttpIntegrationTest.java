package com.rightware.clinicflow.catalog;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class CatalogManagementHttpIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired NamedParameterJdbcTemplate jdbc;

    @Test
    void catalogCrudIsAdminOnlyTenantScopedAndReversible() throws Exception {
        UUID tenant=createTenant(),other=createTenant();
        UUID admin=createUser(tenant,"CLINIC_ADMIN");
        UUID reception=createUser(tenant,"RECEPTION");
        UUID otherAdmin=createUser(other,"CLINIC_ADMIN");

        mvc.perform(post("/api/v1/clinic-units")
                .with(user(email(reception))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Reception cannot create\"}"))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/clinic-units")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Central Unit\",\"address\":\"Maputo\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Central Unit"));

        UUID unit=jdbc.queryForObject("""
            SELECT id FROM clinic_units WHERE tenant_id=:tenant AND name='Central Unit'
            """,Map.of("tenant",tenant),UUID.class);
        assertNotNull(unit);

        mvc.perform(get("/api/v1/clinic-units/"+unit)
                .with(user(email(otherAdmin)))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/clinic-units/"+unit+"/deactivate")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));
        mvc.perform(post("/api/v1/clinic-units/"+unit+"/reactivate")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(true));

        mvc.perform(post("/api/v1/services")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Consulta Geral","slug":"consulta-geral",
                     "durationMinutes":30,"price":500,"currencyCode":null}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("PRICE_AND_CURRENCY_REQUIRED_TOGETHER"));

        mvc.perform(post("/api/v1/services")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Consulta Geral","slug":"consulta-geral",
                     "durationMinutes":30,"price":500,"currencyCode":"MZN"}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.currencyCode").value("MZN"));

        UUID service=jdbc.queryForObject("""
            SELECT id FROM service_definitions
            WHERE tenant_id=:tenant AND slug='consulta-geral'
            """,Map.of("tenant",tenant),UUID.class);
        assertNotNull(service);
        mvc.perform(post("/api/v1/services/"+service+"/deactivate")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));
        mvc.perform(post("/api/v1/services/"+service+"/reactivate")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(true));

        mvc.perform(get("/api/v1/services")
                .with(user(email(reception)))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Consulta Geral"));
        mvc.perform(get("/api/v1/services")
                .with(user(email(otherAdmin)))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isForbidden());
    }

    @Test
    void pendingAppointmentsPreventUnitOrServiceDeactivation() throws Exception {
        UUID tenant=createTenant();
        UUID admin=createUser(tenant,"CLINIC_ADMIN");
        UUID doctor=createUser(tenant,"PRACTITIONER");
        jdbc.update("""
            INSERT INTO practitioner_profiles(tenant_id,user_id,professional_title)
            VALUES(:tenant,:user,'Médico')
            """,Map.of("tenant",tenant,"user",doctor));
        UUID unit=UUID.randomUUID(),service=UUID.randomUUID(),patient=UUID.randomUUID();
        jdbc.update("INSERT INTO clinic_units(id,tenant_id,name) VALUES(:id,:tenant,:name)",
            Map.of("id",unit,"tenant",tenant,"name","Unit "+unit));
        jdbc.update("""
            INSERT INTO service_definitions(id,tenant_id,name,slug,duration_minutes)
            VALUES(:id,:tenant,'Consultation',:slug,30)
            """,Map.of("id",service,"tenant",tenant,"slug","service-"+service));
        jdbc.update("""
            INSERT INTO patients(id,tenant_id,name,date_of_birth,gender)
            VALUES(:id,:tenant,'Synthetic Patient',:birth,'NOT_DISCLOSED')
            """,Map.of("id",patient,"tenant",tenant,"birth",LocalDate.of(1990,1,1)));

        UUID appointment=UUID.randomUUID();
        LocalDateTime start=LocalDateTime.now().plusDays(2).withSecond(0).withNano(0);
        jdbc.update("""
            INSERT INTO appointments
                (id,tenant_id,patient_id,practitioner_user_id,unit_id,service_id,
                 starts_at,ends_at,status,created_by,idempotency_key,request_hash)
            VALUES(:id,:tenant,:patient,:doctor,:unit,:service,
                   :start,:end,'REQUESTED',:actor,:key,:hash)
            """,new MapSqlParameterSource()
                .addValue("id",appointment).addValue("tenant",tenant)
                .addValue("patient",patient).addValue("doctor",doctor)
                .addValue("unit",unit).addValue("service",service)
                .addValue("start",start).addValue("end",start.plusMinutes(30))
                .addValue("actor",admin).addValue("key",UUID.randomUUID())
                .addValue("hash","a".repeat(64)));

        mvc.perform(post("/api/v1/clinic-units/"+unit+"/deactivate")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("CLINIC_UNIT_HAS_ACTIVE_APPOINTMENTS"));
        mvc.perform(post("/api/v1/services/"+service+"/deactivate")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("SERVICE_HAS_ACTIVE_APPOINTMENTS"));

        jdbc.update("""
            UPDATE appointments SET status='CANCELLED'
            WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",tenant,"id",appointment));

        mvc.perform(post("/api/v1/clinic-units/"+unit+"/deactivate")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));
        mvc.perform(post("/api/v1/services/"+service+"/deactivate")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));
    }

    private UUID createTenant(){
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id",id,"name","Catalog Clinic "+id));
        return id;
    }
    private UUID createUser(UUID tenant,String role){
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO users(id,email,display_name,password_hash)
            VALUES(:id,:email,:name,'test-only-unused')
            """,Map.of("id",id,"email",email(id),"name",role));
        jdbc.update("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:user,:role)
            """,Map.of("tenant",tenant,"user",id,"role",role));
        return id;
    }
    private String email(UUID id){return "catalog-"+id+"@example.invalid";}
}
