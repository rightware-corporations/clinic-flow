package com.rightware.clinicflow.platform.identity;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class IdentityUserDetailsService implements UserDetailsService {
    private final NamedParameterJdbcTemplate jdbc;

    public IdentityUserDetailsService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        List<UserDetails> users = jdbc.query("""
            SELECT email, password_hash, enabled
            FROM users WHERE lower(email) = lower(:email)
            """, Map.of("email", email.trim()), (rs, index) ->
                User.withUsername(rs.getString("email"))
                    .password(rs.getString("password_hash"))
                    .authorities("ROLE_USER")
                    .disabled(!rs.getBoolean("enabled"))
                    .build());
        if (users.isEmpty()) {
            throw new UsernameNotFoundException("Account not found");
        }
        return users.getFirst();
    }
}
