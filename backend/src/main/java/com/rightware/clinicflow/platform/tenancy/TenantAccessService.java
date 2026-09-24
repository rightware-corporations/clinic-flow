package com.rightware.clinicflow.platform.tenancy;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class TenantAccessService {
    private final NamedParameterJdbcTemplate jdbc;

    public TenantAccessService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public TenantAccess requireMembership(Authentication authentication, UUID tenantId) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Authentication required");
        }
        List<TenantAccess> matches = jdbc.query("""
            SELECT u.id AS user_id, m.tenant_id, m.role
            FROM users u
            JOIN tenant_memberships m ON m.user_id = u.id
            JOIN organizations o ON o.id = m.tenant_id
            WHERE lower(u.email) = lower(:email)
              AND u.enabled AND m.active AND o.status = 'ACTIVE'
              AND m.tenant_id = :tenant
            """, Map.of("email", authentication.getName(), "tenant", tenantId),
            (rs, index) -> new TenantAccess(
                rs.getObject("user_id", UUID.class),
                rs.getObject("tenant_id", UUID.class),
                rs.getString("role")));
        if (matches.isEmpty()) {
            throw new AccessDeniedException("No active membership in selected clinic");
        }
        return matches.getFirst();
    }

    public TenantAccess requireClinicAdmin(Authentication authentication, UUID tenantId) {
        TenantAccess access = requireMembership(authentication, tenantId);
        if (!access.role().equals("CLINIC_ADMIN")) {
            throw new AccessDeniedException("Clinic administrator required");
        }
        return access;
    }

    /**
     * Demographic registry V1 is limited to clinic administrator and reception.
     * Practitioners/interns require a verified care relationship (future slice).
     */
    public TenantAccess requirePatientRegistryAccess(Authentication auth, UUID tenantId) {
        TenantAccess access = requireMembership(auth, tenantId);
        if (!access.role().equals("CLINIC_ADMIN") && !access.role().equals("RECEPTION")) {
            throw new AccessDeniedException("Patient registry access requires clinic admin or reception");
        }
        return access;
    }

    public record TenantAccess(UUID userId, UUID tenantId, String role) {}
}
