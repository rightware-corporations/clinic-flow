package com.rightware.clinicflow.identity;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SecureInvitationHttpIntegrationTest {
    private static final Pattern TOKEN = Pattern.compile("\\\"token\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");

    @Autowired MockMvc mvc;
    @Autowired NamedParameterJdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;

    @Test
    void newAccountInviteIsTenantScopedSingleUseCsrfProtectedAndRoleBound() throws Exception {
        UUID tenant=tenant("Invite Clinic");
        UUID other=tenant("Other Clinic");
        UUID admin=user(tenant,"CLINIC_ADMIN","Admin",encoder.encode("Admin-Password-2026"));
        UUID otherAdmin=user(other,"CLINIC_ADMIN","Other Admin",encoder.encode("Other-Admin-Password-2026"));
        String adminEmail=email(admin);

        // Role escalation is impossible through invitation input.
        mvc.perform(post("/api/v1/admin/invitations").with(user(adminEmail)).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"future-admin@example.invalid","displayName":"Escalation",
                     "role":"CLINIC_ADMIN"}
                    """))
            .andExpect(status().isBadRequest());

        var created=mvc.perform(post("/api/v1/admin/invitations")
                .with(user(adminEmail)).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"new-practitioner@example.invalid",
                     "displayName":"New Practitioner","role":"PRACTITIONER"}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.role").value("PRACTITIONER"))
            .andReturn();
        String token=token(created.getResponse().getContentAsString());
        assertTrue(token.length()>=20);

        String tokenHash=jdbc.queryForObject("""
            SELECT token_hash FROM user_invitations
            WHERE tenant_id=:tenant AND email=:email
            """,Map.of("tenant",tenant,"email","new-practitioner@example.invalid"),String.class);
        assertNotNull(tokenHash);
        assertNotEquals(token,tokenHash);
        assertEquals(64,tokenHash.length());

        // The raw token never appears in the API path; anonymous inspection uses a header.
        mvc.perform(get("/api/v1/auth/invitations/current")
                .header("X-Clinicflow-Invitation",token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.clinicName").value("Invite Clinic"))
            .andExpect(jsonPath("$.existingAccount").value(false));

        // Public acceptance still requires CSRF.
        mvc.perform(post("/api/v1/auth/invitations/current/accept")
                .header("X-Clinicflow-Invitation",token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"Strong-New-Password-2026\"}"))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/auth/invitations/current/accept").with(csrf())
                .header("X-Clinicflow-Invitation",token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"Strong-New-Password-2026\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.tenantId").value(tenant.toString()))
            .andExpect(jsonPath("$.role").value("PRACTITIONER"));

        Integer membership=jdbc.queryForObject("""
            SELECT count(*) FROM tenant_memberships m
            JOIN users u ON u.id=m.user_id
            WHERE m.tenant_id=:tenant AND lower(u.email)=:email
              AND m.role='PRACTITIONER' AND m.active
            """,Map.of("tenant",tenant,"email","new-practitioner@example.invalid"),Integer.class);
        assertEquals(1,membership);

        // Replay after acceptance is gone, even with a valid CSRF token.
        mvc.perform(post("/api/v1/auth/invitations/current/accept").with(csrf())
                .header("X-Clinicflow-Invitation",token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"Strong-New-Password-2026\"}"))
            .andExpect(status().isGone());

        // Another tenant admin cannot list this clinic's invitations.
        mvc.perform(get("/api/v1/admin/invitations")
                .with(user(email(otherAdmin)))
                .header("X-Clinicflow-Tenant",tenant))
            .andExpect(status().isForbidden());
    }

    @Test
    void existingAccountRequiresItsCurrentPasswordAndExpiredInviteCanBeReissued() throws Exception {
        UUID tenant=tenant("Target Clinic");
        UUID source=tenant("Source Clinic");
        UUID admin=user(tenant,"CLINIC_ADMIN","Admin",encoder.encode("Admin-Password-2026"));
        String existingEmail="existing-user@example.invalid";
        String existingPassword="Existing-Account-Password-2026";
        UUID existing=userWithEmail(source,"PRACTITIONER","Existing User",
            existingEmail,encoder.encode(existingPassword));

        var created=mvc.perform(post("/api/v1/admin/invitations")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"existing-user@example.invalid",
                     "displayName":"Existing User","role":"RECEPTION"}
                    """))
            .andExpect(status().isCreated()).andReturn();
        String token=token(created.getResponse().getContentAsString());

        mvc.perform(get("/api/v1/auth/invitations/current")
                .header("X-Clinicflow-Invitation",token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.existingAccount").value(true));

        mvc.perform(post("/api/v1/auth/invitations/current/accept").with(csrf())
                .header("X-Clinicflow-Invitation",token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"Ignored-New-Password-2026\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("EXISTING_ACCOUNT_AUTH_REQUIRED"));

        mvc.perform(post("/api/v1/auth/invitations/current/accept").with(csrf())
                .header("X-Clinicflow-Invitation",token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"existingAccountPassword\":\"wrong-password\"}"))
            .andExpect(status().isUnauthorized());

        mvc.perform(post("/api/v1/auth/invitations/current/accept").with(csrf())
                .header("X-Clinicflow-Invitation",token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"existingAccountPassword\":\""+existingPassword+"\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.userId").value(existing.toString()))
            .andExpect(jsonPath("$.role").value("RECEPTION"));

        String stored=jdbc.queryForObject("SELECT password_hash FROM users WHERE id=:id",
            Map.of("id",existing),String.class);
        assertTrue(encoder.matches(existingPassword,stored));

        // Create another invite, expire it in DB, then prove reissue does not get stuck
        // behind the active-email unique index.
        var first=mvc.perform(post("/api/v1/admin/invitations")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"expiring@example.invalid",
                     "displayName":"Expiring User","role":"INTERN"}
                    """))
            .andExpect(status().isCreated()).andReturn();
        String expiredToken=token(first.getResponse().getContentAsString());
        jdbc.update("""
            UPDATE user_invitations SET expires_at=:expired
            WHERE tenant_id=:tenant AND lower(email)='expiring@example.invalid'
            """,Map.of("expired",OffsetDateTime.now().minusHours(1),"tenant",tenant));

        mvc.perform(get("/api/v1/auth/invitations/current")
                .header("X-Clinicflow-Invitation",expiredToken))
            .andExpect(status().isGone());

        mvc.perform(post("/api/v1/admin/invitations")
                .with(user(email(admin))).with(csrf())
                .header("X-Clinicflow-Tenant",tenant)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"expiring@example.invalid",
                     "displayName":"Replacement User","role":"INTERN"}
                    """))
            .andExpect(status().isCreated());

        Integer terminalOld=jdbc.queryForObject("""
            SELECT count(*) FROM user_invitations
            WHERE tenant_id=:tenant AND lower(email)='expiring@example.invalid'
              AND revoked_at IS NOT NULL
            """,Map.of("tenant",tenant),Integer.class);
        assertEquals(1,terminalOld);
    }

    private UUID tenant(String name) {
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id",id,"name",name));
        return id;
    }
    private UUID user(UUID tenant,String role,String name,String hash) {
        return userWithEmail(tenant,role,name,email(UUID.randomUUID()),hash);
    }
    private UUID userWithEmail(UUID tenant,String role,String name,String email,String hash) {
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO users(id,email,display_name,password_hash)
            VALUES(:id,:email,:name,:hash)
            """,Map.of("id",id,"email",email,"name",name,"hash",hash));
        jdbc.update("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:user,:role)
            """,Map.of("tenant",tenant,"user",id,"role",role));
        return id;
    }
    private String email(UUID id) {
        return "invite-"+id+"@example.invalid";
    }
    private String token(String body) {
        var match=TOKEN.matcher(body);
        assertTrue(match.find(),"Invitation response must contain one-time token");
        return match.group(1);
    }
}
