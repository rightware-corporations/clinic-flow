package com.rightware.clinicflow.platform.identity;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class IdentityController {
    private final NamedParameterJdbcTemplate jdbc;

    public IdentityController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/v1/auth/csrf")
    public Map<String, String> csrf(CsrfToken token) {
        return Map.of("header", token.getHeaderName(), "token", token.getToken());
    }

    @GetMapping("/api/v1/me")
    public Me me(Authentication authentication) {
        var users = jdbc.query("""
            SELECT id, email, display_name FROM users
            WHERE lower(email) = lower(:email) AND enabled
            """, Map.of("email", authentication.getName()), (rs, index) ->
                new BasicUser(rs.getObject("id", UUID.class),
                    rs.getString("email"), rs.getString("display_name")));
        if (users.isEmpty()) {
            throw new org.springframework.security.access.AccessDeniedException("Account disabled");
        }
        var user = users.getFirst();
        List<Membership> memberships = jdbc.query("""
            SELECT m.tenant_id, o.name AS clinic_name, m.role
            FROM tenant_memberships m JOIN organizations o ON o.id = m.tenant_id
            WHERE m.user_id = :id AND m.active AND o.status = 'ACTIVE'
            ORDER BY o.name
            """, Map.of("id", user.id()), (rs, index) ->
                new Membership(rs.getObject("tenant_id", UUID.class),
                    rs.getString("clinic_name"), rs.getString("role")));
        return new Me(user.id(), user.email(), user.displayName(), memberships);
    }

    public record BasicUser(UUID id, String email, String displayName) {}
    public record Membership(UUID tenantId, String clinicName, String role) {}
    public record Me(UUID id, String email, String displayName,
                     List<Membership> memberships) {}
}
