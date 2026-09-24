# CF-B5B — Internal appointments UI handoff

Status: engineering slice only; not approved for live patient data.

## Delivered
- Authenticated /marcacoes agenda: admin, reception and practitioner.
- Reception/admin can create, confirm, cancel, flag no-show and reschedule.
- Assigned practitioner can start/complete own appointments; admin override remains server-controlled.
- Booking form uses active patient search, a reception-safe practitioner directory,
  current service/unit assignments and PostgreSQL-backed slot previews.
- UUID idempotency key retained when retrying identical failed submissions, reset
  when form inputs change.
- Calendar uses server-returned patient, professional, service and unit names.
- Appointment GET/list access is audited; versioned status commands preserve workflow history.
- Public /agendar remains an explicit frontend demo, with no real persistence.

## Access boundaries
- Booking directory omits email, license, bio and personal contact data.
- Reception may preview slots but cannot edit weekly scheduling rules or blocks.
- Practitioner calendar is restricted server-side to own assigned appointments.
- UI role gating is only UX: real checks are server membership and tenant-scoped SQL.

## Gates
- Frontend lint/typecheck/Vitest/build and backend Maven+Flyway integration tests.
- Browser smoke tests with local PostgreSQL: NOT RUN.
- Railway staging: NOT RUN.

## Production blockers
Clinic timezone/DST decisions, invitations/onboarding, privacy/security review,
backup/restore rehearsal and removal of remaining mock dashboards/clinical reports.
Use synthetic data only.
