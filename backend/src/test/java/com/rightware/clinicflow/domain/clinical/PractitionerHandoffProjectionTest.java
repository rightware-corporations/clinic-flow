package com.rightware.clinicflow.domain.clinical;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PractitionerHandoffProjectionTest {
    @Test
    void contradictorySnapshotsAreNotPresentedAsCompletedOrAbsent() {
        UUID appointment = UUID.randomUUID();
        assertEquals("INCONSISTENT", PractitionerHandoffController.classify(
            new PractitionerHandoffController.Snapshot(appointment, false, "SUBMITTED", 0, 0)));
        assertEquals("INCONSISTENT", PractitionerHandoffController.classify(
            new PractitionerHandoffController.Snapshot(appointment, true, null, 1, 1)));
        assertEquals("INCONSISTENT", PractitionerHandoffController.classify(
            new PractitionerHandoffController.Snapshot(appointment, true, "ACKNOWLEDGED", 1, 2)));
        assertEquals("ORIGINAL_RECEIPT_PENDING", PractitionerHandoffController.classify(
            new PractitionerHandoffController.Snapshot(appointment, true, "SUBMITTED", 1, 1)));
    }

    @Test
    void aDatabaseFailureProduces503AndNoAuditOrFalseNegativeState() {
        var jdbc = mock(NamedParameterJdbcTemplate.class);
        var tenants = mock(TenantAccessService.class);
        var audit = mock(AuditWriter.class);
        var authentication = mock(Authentication.class);
        UUID tenant = UUID.randomUUID();
        UUID doctor = UUID.randomUUID();
        UUID appointment = UUID.randomUUID();

        when(tenants.requireMembership(authentication, tenant)).thenReturn(
            new TenantAccessService.TenantAccess(doctor, tenant, "PRACTITIONER"));
        when(jdbc.query(anyString(), anyMap(),
            org.mockito.ArgumentMatchers.<RowMapper<PractitionerHandoffController.Snapshot>>any()))
            .thenThrow(new DataAccessResourceFailureException("synthetic source unavailable"));

        var controller = new PractitionerHandoffController(jdbc, tenants, audit);
        var error = assertThrows(ResponseStatusException.class,
            () -> controller.getOwnHandoff(tenant, appointment, authentication));
        assertEquals(503, error.getStatusCode().value());
        assertEquals("HANDOFF_SOURCE_UNAVAILABLE", error.getReason());
        verifyNoInteractions(audit);
    }
}
