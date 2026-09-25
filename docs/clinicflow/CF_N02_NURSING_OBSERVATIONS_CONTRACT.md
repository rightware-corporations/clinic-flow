# ClinicFlow — CF-N02: Nursing observations and clinician hand-off

Status: **technical contract / implementation candidate; not a clinical protocol approval**.
Baseline: CF-N01 merged into main @ af630b65258586050e27fba748851690438e5a9c.
Target branch: `feat/cf-n02-nursing-observations-contract`.

## 1. Purpose and boundary
Build a real, tenant-scoped, appointment-bound nursing observations workflow for a nurse explicitly
assigned to the appointment's active unit. A patient's check-in must exist, and their appointment
must be CONFIRMED or IN_PROGRESS when a nurse starts documenting. This is a record-and-hand-off
workflow, **not** an automated acuity classification, diagnosis, advice, prescription,
medication administration, or emergency decision engine.

The Interagency Integrated Triage Tool is a WHO/ICRC/MSF clinical tool intended for
facility-based emergency units, with age-specific algorithms, training and local workflow.
It is not automatically adopted by merely displaying triage colours in ClinicFlow.
See https://www.who.int/tools/triage.
The Observation resource and vital-sign profiles in HL7 FHIR inform future interoperability,
but this local persistence contract does **not** claim FHIR conformance.
See https://hl7.org/fhir/R5/observation.html and https://hl7.org/fhir/R5/observation-vitalsigns.html.

## 2. Actors and least-privilege matrix

| Action | NURSE (assigned active unit) | PRACTITIONER (assigned appointment; active profile) | RECEPTION | CLINIC_ADMIN | INTERN | PATIENT |
|---|---:|---:|---:|---:|---:|---:|
| See minimal arrival metadata | Own assigned units, CF-N01 | Own arrivals, CF-C01 | Reception queue | Existing permitted operations | No new access | No new access |
| Start nursing observation draft | Yes, after check-in | No | No | No | No | No |
| Read/update nursing draft | Author only, while still assigned | No | No | No | No | No |
| Submit nursing draft | Author only, while still assigned | No | No | No | No | No |
| Read submitted nursing observation | Author while assigned | Own appointment only, active practitioner | No | No | No | No |
| Acknowledge receipt of submitted note | No | Own appointment only | No | No | No | No |
| Read clinician-owned clinical reports | No | Existing report-author policy | No | No new access | No | No |

Revocation of the nurse's unit assignment or inactive membership immediately blocks nurse
reads and writes, including prior authored drafts. Clinician reads are bound to their own
appointment and tenant. Never use client-side route protection as the authorization source.

## 3. State machine
- `DRAFT`: opened by assigned nurse after reception check-in. Author can edit with optimistic
  versioning while assigned. No clinician visibility yet.
- `SUBMITTED`: nurse explicitly hands off an observation note. Content becomes immutable at
  API and PostgreSQL levels; server timestamps and author identity are retained.
- `ACKNOWLEDGED`: assigned active practitioner records that the submitted note was seen.
  This is **receipt only**, not a countersign, diagnosis, medical validation or statement
  that all details are correct. Original submitted content stays immutable.
- No deletion endpoint and no silent editing of submitted information. Post-submission
  corrections require a separate additive correction workflow before production deployment.

The appointment's ordinary lifecycle remains independent. CF-N02 does not automatically
start a consultation, change reception queue status, assign medical urgency, or delay emergency care.
If a patient requires immediate action, staff must follow the clinic's approved in-person procedure;
ClinicFlow does not classify or route emergencies in this increment.

## 4. Observation payload and provenance
First slice fields: brief presenting concern as recorded by the nurse (optional text),
nurse observation note (optional text), and *optional* single set of measured values:
body temperature °C, heart rate beats/min, respiratory rate breaths/min, oxygen
saturation %, and systolic/diastolic blood pressure mmHg. All measurements must be
labelled with their fixed units and measurement timestamp when recorded. Numeric validation
checks only type, finite representation and physical plausibility; it MUST NOT use
ranges as clinical decision thresholds. Do not infer missing values, default to normal,
autogenerate diagnoses or infer triage scores. Clinician-approved definitions, exact field
requirements, paediatric adaptations and unit conversions remain open governance items.

Link: (tenant_id, appointment_id) -> existing appointments -> existing patients, practitioner,
unit. Author is a verified NURSE membership with an explicit active unit assignment at write time.
The `nursing_observations` table is distinct from `clinical_reports`, and has composite
tenant foreign keys and versioned DRAFT updates. Use server-owned immutable submission timestamps.
Separate append-only `nursing_observation_events` records structural transitions only.
`acknowledged_by` and `acknowledged_at` must identify the assigned active practitioner.

## 5. HTTP contract, version 1
- `POST /api/v1/nursing/observations`: create DRAFT with appointmentId and optional fields.
  No patientId, authorId, tenantId, appointment status or role accepted from the client.
  One original note per appointment in this slice.
- `GET /api/v1/nursing/observations/{appointmentId}`: author-only while assigned.
- `PUT /api/v1/nursing/observations/{appointmentId}`: versioned DRAFT content update.
- `POST /api/v1/nursing/observations/{appointmentId}/submit`: versioned author-only submit;
  at least one substantive field or observation required.
- `GET /api/v1/practitioner/nursing-observations/{appointmentId}`: only the appointment's
  assigned active practitioner and only after submission.
- `POST /api/v1/practitioner/nursing-observations/{appointmentId}/acknowledge`:
  idempotent receipt of SUBMITTED record; never edits original note.
- Missing/foreign appointments or notes must not leak clinical content or existence.
  Handle uniqueness conflicts explicitly; optimistic version conflicts HTTP 409.
  All mutations require existing session CSRF; all requests require verified tenant membership.

## 6. Screen contracts
N01 `/enfermagem`: retain truthful assigned-unit arrivals, add per-arrival explicit
"Registar observações" action when checked-in. No clinical data in arrival list response.
N02 `/enfermagem/observacoes/:appointmentId`: author-only load/create/edit/submit,
with conspicuous DRAFT versus SUBMITTED badges, measured-value labels, no autogenerated
severity badge, and confirmation before immutable submit. Present error/forbidden/conflict
states distinctly. No offline storage or localStorage clinical payloads.
C01 practitioner: minimal indicator when submitted nursing note exists for assigned
appointment; read-only detail and separate "Confirmar recepção" acknowledgement.
No admin, reception, intern or patient page displays nursing clinical content.

## 7. Security, audit and operational gates
- PHI stays out of URL query parameters, audit event bodies, exception messages, telemetry
  and logs. Audit metadata only: tenant, actor, action, nursing observation id, timestamp.
- Do not surface nursing content via the CF-N01 arrival endpoint or reports endpoint.
- Tenant, appointment, patient, clinician and active unit relationship enforced in SQL joins,
  not trusted input.
- Restrict existing clinical reports to their author; no cross-domain privilege expansion.
- Version checks and row locks protect concurrent edit/submit/acknowledge.
- No synthetic or fabricated patient content in production views.

### Tests required before merge
1. Nurse cannot start without check-in, in an unassigned/inactive/foreign unit, or for another
   tenant; reception/admin/intern/patient cannot read or author nursing content.
2. Assigned nurse creates DRAFT, updates once with version, stale update fails; another
   assigned nurse is not the author and cannot read the draft.
3. SUBMITTED is clinician-readable only for the linked practitioner; another practitioner
   cannot access it. Nurse cannot mutate submitted content even through raw SQL.
4. The assigned practitioner can acknowledge once; repeat is idempotent, receipt is not a
   clinical countersign. Submitted content remains byte-for-byte unchanged.
5. Unit revocation blocks nurse access; no report/registry privilege escalation.
6. Validate empty submit, malformed measurement, csrf and no PHI leakage in audit rows.
7. Run backend Maven verify on PostgreSQL 16 with Flyway V1–V10; frontend lint/TS/tests/build,
   PR CI and post-merge main CI. Record each gate independently.

## 8. Explicit production blockers (not resolved by CI)
Clinical director or suitably qualified local clinician must validate workflow, vital sign
field definitions, age-related rules, escalation, required observations, error correction,
supervision and retention. Legal/privacy review for Mozambique, threat modelling, secure
deployment, backup/restore drill, staging, usability with clinical staff, incident response
and patient-data governance are separate gates. Use synthetic data until approved.
Manual clinical acuity, emergency triage algorithms, IITT adoption, clinical countersigning,
addenda, medication, prescriptions and paediatric workflow are **out of scope** here.

## 9. Delivery order
CF-N02A: this contract and schema/API access tests.
CF-N02B: nurse UI and clinician read/receipt UX with tests.
CF-N02C: clinical governance and staging sign-off before enabling real patient use.
Full Clinic Admin / SuperAdmin dashboards remain **last** after operational portals.
