package com.rightware.clinicflow.tenancy;

import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class TenantIsolationIntegrationTest {
    @Autowired NamedParameterJdbcTemplate jdbc;
    @Autowired TenantAccessService tenants;

    @Test
    void aMemberCannotAccessAnotherClinic() {
        UUID clinicA = UUID.randomUUID();
        UUID clinicB = UUID.randomUUID();
        UUID user = UUID.randomUUID();
        String email = "tenant-test-" + user + "@example.invalid";
        jdbc.update("INSERT INTO organizations(id, name) VALUES (:id, :name)",
            Map.of("id", clinicA, "name", "Test Clinic A"));
        jdbc.update("INSERT INTO organizations(id, name) VALUES (:id, :name)",
            Map.of("id", clinicB, "name", "Test Clinic B"));
        jdbc.update("""
            INSERT INTO users(id, email, display_name, password_hash)
            VALUES (:id, :email, :name, :hash)
            """, Map.of("id", user, "email", email,
                "name", "Integration Fixture", "hash", "fixture-not-for-login"));
        jdbc.update("""
            INSERT INTO tenant_memberships(tenant_id, user_id, role)
            VALUES (:tenant, :user, 'RECEPTION')
            """, Map.of("tenant", clinicA, "user", user));
        var principal = new UsernamePasswordAuthenticationToken(email, "ignored",
            List.of(new SimpleGrantedAuthority("ROLE_USER")));
        var access = tenants.requireMembership(principal, clinicA);
        assertEquals(clinicA, access.tenantId());
        assertEquals("RECEPTION", access.role());
        assertThrows(AccessDeniedException.class,
            () -> tenants.requireMembership(principal, clinicB));
        assertThrows(AccessDeniedException.class,
            () -> tenants.requireClinicAdmin(principal, clinicA));
    }
}
