package com.rightware.clinicflow.tenancy;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class DatabaseConstraintsIntegrationTest {
    @Autowired NamedParameterJdbcTemplate jdbc;

    @Test
    void duplicateServiceSlugInSameTenantIsRejectedButCrossTenantAllowed() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        for (UUID tenant : new UUID[] {a, b}) {
            jdbc.update("INSERT INTO organizations(id,name) VALUES(:id,:name)",
                Map.of("id", tenant, "name", "Clinic-" + tenant));
        }
        String sql = """
            INSERT INTO service_definitions
                (id, tenant_id, name, slug, duration_minutes)
            VALUES (:id, :tenant, :name, :slug, 30)
            """;
        jdbc.update(sql, Map.of("id", UUID.randomUUID(), "tenant", a,
            "name", "General Medicine", "slug", "general-medicine"));
        assertThrows(DuplicateKeyException.class, () -> jdbc.update(sql,
            Map.of("id", UUID.randomUUID(), "tenant", a,
                "name", "Duplicate", "slug", "general-medicine")));
        assertDoesNotThrow(() -> jdbc.update(sql,
            Map.of("id", UUID.randomUUID(), "tenant", b,
                "name", "Tenant-specific", "slug", "general-medicine")));
    }
}
