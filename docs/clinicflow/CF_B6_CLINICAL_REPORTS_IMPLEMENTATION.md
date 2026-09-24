# CF-B6 — Clinical report core: synthetic data only

Baseline: main@d39fc7ce6ab5ec89521cab9c2d7e6c03abd1dabb.
Branch: feat/clinicflow-clinical-reports-core.

## Decisions for this slice
- Authoring and reading clinical content: verified active PRACTITIONER with
  active profile, author ownership and an assigned appointment in the same tenant.
- Appointment status must be IN_PROGRESS or COMPLETED to create a report.
- One original report per appointment and author. Technical draft is editable
  with optimistic versioning until finalized.
- Finalized source content is immutable at both API and PostgreSQL trigger levels.
  Corrections are additive, timestamped, immutable addenda; no clinical data in
  audit events or exception bodies.
- Only author can write/read their report and addenda. CLINIC_ADMIN, RECEPTION,
  INTERN and PATIENT cannot read clinical report content in this slice. Clinical
  supervisor access, emergency override and patient portal require explicit
  policy decisions and auditable access rules.
- No prescription creation/validity claims in this slice. Report types:
  CONSULTATION / DIAGNOSTIC / FOLLOW_UP.
- No PDFs, exports, notification integrations or billing here.
- No real patient records until threat modelling, encryption/retention, backup
  restore, privacy/legal policy and incident response gates are completed.

## Data integrity
Flyway V6 links clinical_reports to appointments with a composite FK
(tenant, appointment, patient, professional), preventing identity mismatch.
Archive/cancel behaviour is intentionally restricted: a report cannot be
authored for a cancelled or never-started appointment.
Database trigger denies update of finalized reports and deletes of any original.
Addenda and report events are append-only at the database boundary.
A report cannot be finalized empty: one substantive clinical field is required.

## Verification
CI: Maven verify with PostgreSQL 16 and Flyway V1–V6; frontend lint, TS,
Vitest and build. HTTP tests must prove owner-only reads, malicious tenant
header denial, reception/admin/intern denial, stale edit conflict, finalization,
DB immutability, append-only addenda, concurrency/idempotency behaviour.
Manual browser: NOT RUN until an actual smoke test is performed.
Railway staging: NOT RUN.

## Known follow-ups
- Replace old medical report localStorage screens with authenticated /api/v1/clinical-reports.
- Add clinician encounter workflow and patient-care relationship history beyond
  a single appointment; supervisor access only after policy approval.
- Finalize country/timezone, retention and legal compliance before production.

## CF-B6B integration point
- GET /api/v1/clinical-reports/eligible-appointments returns up to 100 started/completed
  encounters with minimal patient identity, only to their assigned active clinician.
- Existing reports are excluded; newly created originals bind the selected appointment
  to the same tenant and author. No general patient registry access is granted.
- GET is transactionally audited without content or query logging.
