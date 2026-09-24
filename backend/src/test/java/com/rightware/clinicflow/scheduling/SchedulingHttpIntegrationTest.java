package com.rightware.clinicflow.scheduling;

import java.time.LocalDate;
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
class SchedulingHttpIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired NamedParameterJdbcTemplate jdbc;

    @Test
    void deterministicSlotsRespectRulesBlocksAssignmentsAndTenant() throws Exception {
        UUID tenant=UUID.randomUUID(), other=UUID.randomUUID();
        ensureTenant(tenant); ensureTenant(other);
        UUID admin=createUser(tenant,"CLINIC_ADMIN");
        UUID practitioner=createUser(tenant,"PRACTITIONER");
        UUID otherAdmin=createUser(other,"CLINIC_ADMIN");
        UUID unit=createUnit(tenant);
        UUID service=createService(tenant,30);
        createProfile(tenant,practitioner,unit,service);

        LocalDate date=LocalDate.now().plusDays(2);
        int day=date.getDayOfWeek().getValue();
        String adminEmail=email(admin);
        String rule="""
            {"practitionerUserId":"%s","unitId":"%s","dayOfWeek":%d,
             "startTime":"09:00","endTime":"11:00","slotIntervalMinutes":30}
            """.formatted(practitioner,unit,day);
        mvc.perform(post("/api/v1/scheduling/rules").with(user(adminEmail)).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON).content(rule))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.startTime").value("09:00:00"));

        String overlap="""
            {"practitionerUserId":"%s","unitId":"%s","dayOfWeek":%d,
             "startTime":"10:30","endTime":"12:00","slotIntervalMinutes":30}
            """.formatted(practitioner,unit,day);
        mvc.perform(post("/api/v1/scheduling/rules").with(user(adminEmail)).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON).content(overlap))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("OVERLAPPING_AVAILABILITY_RULE"));

        String block="""
            {"practitionerUserId":"%s","startsAt":"%sT09:30:00",
             "endsAt":"%sT10:00:00","reason":"Administrative block"}
            """.formatted(practitioner,date,date);
        mvc.perform(post("/api/v1/scheduling/blocks").with(user(adminEmail)).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON).content(block))
            .andExpect(status().isCreated());

        mvc.perform(get("/api/v1/scheduling/slot-preview")
                .with(user(adminEmail)).header("X-Clinicflow-Tenant",tenant)
                .param("practitionerUserId",practitioner.toString())
                .param("serviceId",service.toString()).param("date",date.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.slots.length()").value(3))
            .andExpect(jsonPath("$.slots[0].startsAt").value("09:00:00"))
            .andExpect(jsonPath("$.slots[1].startsAt").value("10:00:00"))
            .andExpect(jsonPath("$.slots[2].startsAt").value("10:30:00"));

        mvc.perform(get("/api/v1/scheduling/slot-preview")
                .with(user(email(otherAdmin))).header("X-Clinicflow-Tenant",tenant)
                .param("practitionerUserId",practitioner.toString())
                .param("serviceId",service.toString()).param("date",date.toString()))
            .andExpect(status().isForbidden());
    }

    private void createProfile(UUID tenant,UUID practitioner,UUID unit,UUID service){
        jdbc.update("""
            INSERT INTO practitioner_profiles(tenant_id,user_id,professional_title)
            VALUES(:tenant,:user,'Médico')
            """,Map.of("tenant",tenant,"user",practitioner));
        jdbc.update("""
            INSERT INTO practitioner_units(tenant_id,practitioner_user_id,unit_id)
            VALUES(:tenant,:user,:unit)
            """,Map.of("tenant",tenant,"user",practitioner,"unit",unit));
        jdbc.update("""
            INSERT INTO practitioner_services(tenant_id,practitioner_user_id,service_id)
            VALUES(:tenant,:user,:service)
            """,Map.of("tenant",tenant,"user",practitioner,"service",service));
    }
    private UUID createUnit(UUID tenant){
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO clinic_units(id,tenant_id,name) VALUES(:id,:tenant,:name)",
            Map.of("id",id,"tenant",tenant,"name","Unit "+id));
        return id;
    }
    private UUID createService(UUID tenant,int duration){
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO service_definitions(id,tenant_id,name,slug,duration_minutes)
            VALUES(:id,:tenant,'Service',:slug,:duration)
            """,Map.of("id",id,"tenant",tenant,"slug","service-"+id,"duration",duration));
        return id;
    }
    private UUID createUser(UUID tenant,String role){
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO users(id,email,display_name,password_hash)
            VALUES(:id,:email,:name,'unused')
            """,Map.of("id",id,"email",email(id),"name",role+" Test"));
        jdbc.update("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:user,:role)
            """,Map.of("tenant",tenant,"user",id,"role",role));
        return id;
    }
    private void ensureTenant(UUID id){
        jdbc.update("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id",id,"name","Clinic "+id));
    }
    private String email(UUID id){return "schedule-"+id+"@example.invalid";}
}
