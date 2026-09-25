package com.rightware.clinicflow.clinical;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class PractitionerHandoffHttpIntegrationTest {
    private static final String API = "/api/v1/practitioner/handoffs/";

    @Autowired MockMvc mvc;
    @Autowired NamedParameterJdbcTemplate jdbc;

    @Test
    void absentAndDraftNotesHaveIdenticalPublicIndicators() throws Exception {
        Fixture f = fixture();
        UUID noCheckin = appointment(f, f.doctorA(), 8);
        UUID noNote = appointment(f, f.doctorA(), 9);
        UUID draft = appointment(f, f.doctorA(), 10);
        checkIn(f, noNote);
        checkIn(f, draft);
        observation(f, draft, "DRAFT");

        mvc.perform(get(API + noCheckin).with(user(email(f.doctorA())))
                .header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "private, no-store"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(jsonPath("$.indicator").value("NO_CHECK_IN"))
            .andExpect(jsonPath("$.checkInRecorded").value(false))
            .andExpect(jsonPath("$.publishedNursingNote").value(nullValue()))
            .andExpect(jsonPath("$.pendingCorrectionReceipts").value(0))
            .andExpect(jsonPath("$.sourceObservedAt").isNotEmpty());

        for (UUID id : List.of(noNote, draft)) {
            mvc.perform(get(API + id).with(user(email(f.doctorA())))
                    .header("X-Clinicflow-Tenant", f.tenant()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.indicator").value("NO_SUBMITTED_NOTE"))
                .andExpect(jsonPath("$.checkInRecorded").value(true))
                .andExpect(jsonPath("$.publishedNursingNote").value(nullValue()))
                .andExpect(jsonPath("$.correctionCount").value(0))
                .andExpect(jsonPath("$.pendingCorrectionReceipts").value(0))
                .andExpect(jsonPath("$.presentingConcern").doesNotExist())
                .andExpect(jsonPath("$.observationNotes").doesNotExist())
                .andExpect(jsonPath("$.patientId").doesNotExist())
                .andExpect(jsonPath("$.authorId").doesNotExist());
        }

        assertEquals(3, auditCount(f, "PRACTITIONER_HANDOFF_VIEWED"));
    }

    @Test
    void submittedNoteAndIndependentCorrectionReceiptsNeverMeanClinicalApproval() throws Exception {
        Fixture f = fixture();
        UUID submitted = appointment(f, f.doctorA(), 11);
        UUID acknowledged = appointment(f, f.doctorA(), 12);
        checkIn(f, submitted);
        checkIn(f, acknowledged);
        UUID submittedNote = observation(f, submitted, "SUBMITTED");
        UUID acknowledgedNote = observation(f, acknowledged, "ACKNOWLEDGED");

        mvc.perform(get(API + submitted).with(user(email(f.doctorA())))
                .header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.indicator").value("ORIGINAL_RECEIPT_PENDING"))
            .andExpect(jsonPath("$.publishedNursingNote").value("SUBMITTED"))
            .andExpect(jsonPath("$.receiptOnly").value(true))
            .andExpect(jsonPath("$.clinicalValidation").doesNotExist());

        addendum(f, submittedNote, false);
        mvc.perform(get(API + submitted).with(user(email(f.doctorA())))
                .header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.indicator").value("ORIGINAL_RECEIPT_PENDING"))
            .andExpect(jsonPath("$.correctionCount").value(1))
            .andExpect(jsonPath("$.pendingCorrectionReceipts").value(1));

        mvc.perform(get(API + acknowledged).with(user(email(f.doctorA())))
                .header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.indicator").value("ALL_RECEIPTS_RECORDED"))
            .andExpect(jsonPath("$.publishedNursingNote").value("ACKNOWLEDGED"))
            .andExpect(jsonPath("$.receiptOnly").value(true));

        UUID late = addendum(f, acknowledgedNote, false);
        addendum(f, acknowledgedNote, true);
        mvc.perform(get(API + acknowledged).with(user(email(f.doctorA())))
                .header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.indicator").value("CORRECTION_RECEIPTS_PENDING"))
            .andExpect(jsonPath("$.correctionCount").value(2))
            .andExpect(jsonPath("$.pendingCorrectionReceipts").value(1));

        jdbc.update("""
            UPDATE nursing_observation_addenda
               SET acknowledged_at=now(), acknowledged_by=:doctor
             WHERE tenant_id=:tenant AND id=:id
            """, Map.of("doctor", f.doctorA(), "tenant", f.tenant(), "id", late));
        mvc.perform(get(API + acknowledged).with(user(email(f.doctorA())))
                .header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.indicator").value("ALL_RECEIPTS_RECORDED"))
            .andExpect(jsonPath("$.pendingCorrectionReceipts").value(0));

        // A correction arriving after all prior receipts reopens the indicator.
        addendum(f, acknowledgedNote, false);
        mvc.perform(get(API + acknowledged).with(user(email(f.doctorA())))
                .header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.indicator").value("CORRECTION_RECEIPTS_PENDING"))
            .andExpect(jsonPath("$.pendingCorrectionReceipts").value(1));

        assertEquals(0, jdbc.queryForObject("""
            SELECT count(*) FROM nursing_observation_events
            WHERE tenant_id=:tenant AND action='ACKNOWLEDGE'
            """, Map.of("tenant", f.tenant()), Integer.class));
    }

    @Test
    void deniesUnassignedAndForeignCliniciansAndAllOtherRoles() throws Exception {
        Fixture f = fixture();
        UUID own = appointment(f, f.doctorA(), 13);
        checkIn(f, own);
        observation(f, own, "SUBMITTED");

        mvc.perform(get(API + own).header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isUnauthorized());

        for (UUID denied : List.of(f.admin(), f.reception(), f.nurse(),
                                f.intern(), f.patientUser())) {
            mvc.perform(get(API + own).with(user(email(denied)))
                    .header("X-Clinicflow-Tenant", f.tenant()))
                .andExpect(status().isForbidden());
        }

        mvc.perform(get(API + own).with(user(email(f.doctorB())))
                .header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error").value("HANDOFF_NOT_FOUND"));

        mvc.perform(get(API + own).with(user(email(f.foreignDoctor())))
                .header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isForbidden());

        mvc.perform(get(API + UUID.randomUUID()).with(user(email(f.doctorA())))
                .header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error").value("HANDOFF_NOT_FOUND"));

        assertEquals(0, auditCount(f, "PRACTITIONER_HANDOFF_VIEWED"));
    }

    @Test
    void suspendedTenantInactiveProfileAndCancelledAppointmentFailClosed() throws Exception {
        Fixture f = fixture();
        UUID own = appointment(f, f.doctorA(), 14);

        jdbc.update("""
            UPDATE appointments SET status='CANCELLED'
            WHERE tenant_id=:tenant AND id=:id
            """, Map.of("tenant", f.tenant(), "id", own));
        mvc.perform(get(API + own).with(user(email(f.doctorA())))
                .header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isNotFound());

        jdbc.update("""
            UPDATE appointments SET status='CONFIRMED'
            WHERE tenant_id=:tenant AND id=:id
            """, Map.of("tenant", f.tenant(), "id", own));
        jdbc.update("""
            UPDATE practitioner_profiles SET active=false
            WHERE tenant_id=:tenant AND user_id=:doctor
            """, Map.of("tenant", f.tenant(), "doctor", f.doctorA()));
        mvc.perform(get(API + own).with(user(email(f.doctorA())))
                .header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isNotFound());

        jdbc.update("""
            UPDATE practitioner_profiles SET active=true
            WHERE tenant_id=:tenant AND user_id=:doctor
            """, Map.of("tenant", f.tenant(), "doctor", f.doctorA()));
        jdbc.update("UPDATE organizations SET status='SUSPENDED' WHERE id=:tenant",
            Map.of("tenant", f.tenant()));
        mvc.perform(get(API + own).with(user(email(f.doctorA())))
                .header("X-Clinicflow-Tenant", f.tenant()))
            .andExpect(status().isForbidden());

        assertEquals(0, auditCount(f, "PRACTITIONER_HANDOFF_VIEWED"));
    }

    private Fixture fixture() {
        UUID tenant = UUID.randomUUID();
        UUID foreign = UUID.randomUUID();
        write("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id", tenant, "name", "J01 Synthetic " + tenant));
        write("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id", foreign, "name", "J01 Foreign " + foreign));
        UUID doctorA = userIn(tenant, "PRACTITIONER");
        UUID doctorB = userIn(tenant, "PRACTITIONER");
        UUID admin = userIn(tenant, "CLINIC_ADMIN");
        UUID reception = userIn(tenant, "RECEPTION");
        UUID nurse = userIn(tenant, "NURSE");
        UUID intern = userIn(tenant, "INTERN");
        UUID patientUser = userIn(tenant, "PATIENT");
        UUID foreignDoctor = userIn(foreign, "PRACTITIONER");
        for (UUID id : List.of(doctorA, doctorB)) {
            write("""
                INSERT INTO practitioner_profiles(tenant_id,user_id,professional_title)
                VALUES(:tenant,:id,'Synthetic doctor')
                """, Map.of("tenant", tenant, "id", id));
        }
        write("""
            INSERT INTO nursing_profiles(tenant_id,user_id) VALUES(:tenant,:id)
            """, Map.of("tenant", tenant, "id", nurse));
        UUID unit = UUID.randomUUID();
        UUID service = UUID.randomUUID();
        write("""
            INSERT INTO clinic_units(id,tenant_id,name)
            VALUES(:id,:tenant,'J01 synthetic unit')
            """, Map.of("id", unit, "tenant", tenant));
        write("""
            INSERT INTO service_definitions(id,tenant_id,name,slug,duration_minutes)
            VALUES(:id,:tenant,'J01 synthetic service',:slug,30)
            """, Map.of("id", service, "tenant", tenant,
                        "slug", "j01-" + service));
        return new Fixture(tenant, doctorA, doctorB, admin, reception,
            nurse, intern, patientUser, foreignDoctor, unit, service);
    }

    private UUID appointment(Fixture f, UUID doctor, int hour) {
        UUID id = UUID.randomUUID();
        UUID patient = UUID.randomUUID();
        write("""
            INSERT INTO patients(id,tenant_id,name,date_of_birth,gender)
            VALUES(:id,:tenant,'Synthetic patient','1990-01-01','F')
            """, Map.of("id", patient, "tenant", f.tenant()));
        var starts = LocalDateTime.of(2026, 9, 25, hour, 0);
        jdbc.update("""
            INSERT INTO appointments(id,tenant_id,patient_id,practitioner_user_id,
              unit_id,service_id,starts_at,ends_at,status,created_by,
              idempotency_key,request_hash)
            VALUES(:id,:tenant,:patient,:doctor,:unit,:service,:start,:end,
              'CONFIRMED',:admin,:key,:hash)
            """, new MapSqlParameterSource()
            .addValue("id", id).addValue("tenant", f.tenant())
            .addValue("patient", patient).addValue("doctor", doctor)
            .addValue("unit", f.unit()).addValue("service", f.service())
            .addValue("start", starts).addValue("end", starts.plusMinutes(30))
            .addValue("admin", f.admin()).addValue("key", UUID.randomUUID())
            .addValue("hash", "0".repeat(64)));
        return id;
    }

    private void checkIn(Fixture f, UUID appointment) {
        write("""
            INSERT INTO reception_checkins(tenant_id,id,appointment_id,checked_in_by)
            VALUES(:tenant,:id,:appointment,:actor)
            """, Map.of("tenant", f.tenant(), "id", UUID.randomUUID(),
                        "appointment", appointment, "actor", f.reception()));
    }

    private UUID observation(Fixture f, UUID appointment, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO nursing_observations(tenant_id,id,appointment_id,author_id,
              status,observation_notes,submitted_at,acknowledged_at,acknowledged_by)
            VALUES(:tenant,:id,:appointment,:nurse,:status,
              'Private synthetic nursing text',:submitted,:ackAt,:ackBy)
            """, new MapSqlParameterSource()
            .addValue("tenant", f.tenant()).addValue("id", id)
            .addValue("appointment", appointment).addValue("nurse", f.nurse())
            .addValue("status", status)
            .addValue("submitted", "DRAFT".equals(status) ? null :
                java.time.OffsetDateTime.now())
            .addValue("ackAt", "ACKNOWLEDGED".equals(status) ?
                java.time.OffsetDateTime.now() : null)
            .addValue("ackBy", "ACKNOWLEDGED".equals(status) ? f.doctorA() : null));
        return id;
    }

    private UUID addendum(Fixture f, UUID observation, boolean acknowledged) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO nursing_observation_addenda(tenant_id,id,observation_id,
              author_id,content,idempotency_key,content_sha,acknowledged_at,
              acknowledged_by)
            VALUES(:tenant,:id,:observation,:nurse,'Private synthetic addendum',
              :key,:hash,:ackAt,:ackBy)
            """, new MapSqlParameterSource()
            .addValue("tenant", f.tenant()).addValue("id", id)
            .addValue("observation", observation).addValue("nurse", f.nurse())
            .addValue("key", UUID.randomUUID()).addValue("hash", "1".repeat(64))
            .addValue("ackAt", acknowledged ? java.time.OffsetDateTime.now() : null)
            .addValue("ackBy", acknowledged ? f.doctorA() : null));
        return id;
    }

    private int auditCount(Fixture f, String action) {
        return jdbc.queryForObject("""
            SELECT count(*) FROM audit_events WHERE tenant_id=:tenant AND action=:action
            """, Map.of("tenant", f.tenant(), "action", action), Integer.class);
    }

    private UUID userIn(UUID tenant, String role) {
        UUID id = UUID.randomUUID();
        write("""
            INSERT INTO users(id,email,display_name,password_hash)
            VALUES(:id,:email,:role,'synthetic-only')
            """, Map.of("id", id, "email", email(id), "role", role));
        write("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:id,:role)
            """, Map.of("tenant", tenant, "id", id, "role", role));
        return id;
    }

    private static String email(UUID id) { return "j01-" + id + "@example.invalid"; }
    private void write(String sql, Map<String,?> args) { jdbc.update(sql, args); }

    private record Fixture(UUID tenant, UUID doctorA, UUID doctorB,
                           UUID admin, UUID reception, UUID nurse, UUID intern,
                           UUID patientUser, UUID foreignDoctor, UUID unit,
                           UUID service) {}
}
