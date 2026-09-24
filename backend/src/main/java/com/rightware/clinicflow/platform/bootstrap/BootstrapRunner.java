package com.rightware.clinicflow.platform.bootstrap;

import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** One-time operator-controlled provisioning; disabled by default everywhere. */
@Component
@ConditionalOnProperty(prefix="clinicflow.bootstrap", name="enabled", havingValue="true")
public class BootstrapRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(BootstrapRunner.class);
    private final NamedParameterJdbcTemplate jdbc;
    private final PasswordEncoder encoder;

    @Value("${clinicflow.bootstrap.admin-email:}") private String email;
    @Value("${clinicflow.bootstrap.admin-password:}") private String password;
    @Value("${clinicflow.bootstrap.clinic-name:}") private String clinicName;

    public BootstrapRunner(NamedParameterJdbcTemplate jdbc, PasswordEncoder encoder) {
        this.jdbc = jdbc;
        this.encoder = encoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (email.isBlank() || password.length() < 14 || clinicName.isBlank()) {
            throw new IllegalStateException(
                "Bootstrap requires admin email, password >=14 characters and clinic name.");
        }
        // A first-run only bootstrap: never grant a second superuser through environment drift.
        Integer count = jdbc.getJdbcTemplate()
            .queryForObject("SELECT count(*) FROM organizations", Integer.class);
        if (count != null && count > 0) {
            log.info("Existing clinic detected. Bootstrap refused; disable bootstrap.");
            return;
        }
        UUID tenant = UUID.randomUUID();
        UUID user = UUID.randomUUID();
        UUID unit = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO organizations (id, name) VALUES (:id, :name)
            """, Map.of("id", tenant, "name", clinicName.trim()));
        jdbc.update("""
            INSERT INTO users (id, email, display_name, password_hash)
            VALUES (:id, :email, :name, :hash)
            """, Map.of("id", user, "email", email.trim().toLowerCase(java.util.Locale.ROOT),
                "name", "Initial Clinic Admin", "hash", encoder.encode(password)));
        jdbc.update("""
            INSERT INTO tenant_memberships (tenant_id, user_id, role)
            VALUES (:tenant, :user, 'CLINIC_ADMIN')
            """, Map.of("tenant", tenant, "user", user));
        jdbc.update("""
            INSERT INTO clinic_units (id, tenant_id, name)
            VALUES (:id, :tenant, :name)
            """, Map.of("id", unit, "tenant", tenant, "name", clinicName.trim()));
        log.warn("First-run clinic provisioned; tenant ID = {}. DISABLE BOOTSTRAP NOW.", tenant);
    }
}
