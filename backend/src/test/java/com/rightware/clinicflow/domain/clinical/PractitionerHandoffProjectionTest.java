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
    @Test
    void aSourceTimeoutReturnsHttp503WithoutAuditOrFabricatedIndicator() throws Exception {
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
            .thenThrow(new org.springframework.dao.QueryTimeoutException("synthetic timeout"));
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(
            new PractitionerHandoffController(jdbc, tenants, audit)).build();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/v1/practitioner/handoffs/" + appointment)
                .header("X-Clinicflow-Tenant", tenant)
                .principal(authentication))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .status().isServiceUnavailable())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$.indicator").doesNotExist());
        verifyNoInteractions(audit);
    }

    @Test
    void anAuditWriteFailureReturnsHttp503AndNeverPublishesASnapshot() throws Exception {
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
            .thenReturn(java.util.List.of(new PractitionerHandoffController.Snapshot(
                appointment, true, "ACKNOWLEDGED", 0, 0)));
        doThrow(new org.springframework.dao.DataAccessResourceFailureException(
            "synthetic audit persistence failure"))
            .when(audit).write(tenant, doctor, "PRACTITIONER_HANDOFF_VIEWED",
                "Appointment", appointment);
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(
            new PractitionerHandoffController(jdbc, tenants, audit)).build();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/v1/practitioner/handoffs/" + appointment)
                .header("X-Clinicflow-Tenant", tenant)
                .principal(authentication))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .status().isServiceUnavailable())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$.indicator").doesNotExist());
        verify(audit).write(tenant, doctor, "PRACTITIONER_HANDOFF_VIEWED",
            "Appointment", appointment);
    }

}
