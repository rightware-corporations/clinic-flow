# ClinicFlow — CF-N03: Nursing observation continuity and additive corrections

**Source:** CF-N02 merged main@8d018dd37e9d4ad71a07c93a04b69e71c140aff8.
**Status:** Technical workflow; synthetic data only. Does NOT constitute clinical governance approval.

## Purpose
A nurse must be able to retrieve her own previous observations in active assigned units,
including completed appointments. An original submitted observation remains immutable. Any
clarification/correction is an **additive, timestamped entry** linked to the original; it
never silently replaces the original. A clinician who has received the original separately
confirms receipt of each later correction. All reads/writes are tenant- and encounter-bound.

## Authorization
- NURSE: active tenant membership and nursing profile, verified *current* assignment to
  appointment's active clinic unit, original observation author, patient not archived,
  appointment CONFIRMED/IN_PROGRESS/COMPLETED. Allowed history, own note, own corrections.
  Unit assignment or membership revocation immediately blocks all these operations.
- PRACTITIONER: active tenant membership and active practitioner profile, **currently
  assigned to the same appointment**, original observation SUBMITTED/ACKNOWLEDGED.
  Can read corrections and acknowledge each correction **only as receipt**.
- CLINIC_ADMIN, RECEPTION, INTERN, PATIENT and unrelated clinicians receive no nursing
  clinical-content grant; the clinic admin retains only N01 unit provisioning.
- An observation may have only one original nurse author in this slice. No supervisor
  takeover, emergency override, automated escalation, diagnosis or acuity scoring.

## State and correction rules
- The original DRAFT -> SUBMITTED -> ACKNOWLEDGED states from CF-N02 do not change.
- Addenda allowed **after SUBMITTED or ACKNOWLEDGED** and while the author retains active
  unit assignment. Completed appointments permit correction but never draft edits.
- Correction has immutable non-empty text (1..3000 chars after trim), original author ID,
  server timestamp, request SHA-256 and client-generated UUID Idempotency-Key.
- Repeating the same key with identical trimmed text returns the original entry; reusing
  it for different text returns HTTP 409. Per-observation row lock serializes retries.
- Each correction has an independent receipt: acknowledgement timestamp + assigned
  clinician ID, recorded once. Acknowledging the original DOES NOT acknowledge later
  corrections. Neither acknowledgement is a countersign or clinical validation.
- Database trigger forbids delete and any correction-content mutation, permitting only
  one NULL -> acknowledged transition, while verifying the currently assigned practitioner.
  Corrections and their receipts are tracked with metadata-only audit events.
- No arbitrary corrections to vital values: nurse uses an explicit textual addendum
  referencing what was recorded and what is being corrected, without rewriting the original.

## HTTP
- GET /api/v1/nursing/observations/history?page=0 : paged 20 latest permitted original
  notes, excluding clinical text. Include patient, appointment, unit, service, status,
  timestamps and correction count. Max page 1000, bounded query.
- GET /api/v1/nursing/observations/history/{appointmentId}: permitted original summary,
  supporting direct access to past notes after completed consultations.
- POST /api/v1/nursing/observations/{appointmentId}/addenda with Idempotency-Key
  and JSON {content}; returns one immutable addendum.
- GET /api/v1/nursing/observations/{appointmentId}/addenda?page=0:
  author-only, paged 20, permitted post-submission.
- GET /api/v1/practitioner/nursing-observations/{appointmentId}/addenda?page=0:
  clinician-only, paged 20, post-submission.
- POST /api/v1/practitioner/nursing-observations/{appointmentId}/addenda/{id}/acknowledge:
  clinician-only idempotent receipt. No client-provided actor/status.
- HTTP 403 for forbidden role/membership, 404 for inaccessible encounter/note/addendum,
  400 for invalid payload, 409 for conflicting idempotency. All mutations require
  session CSRF and verified X-Clinicflow-Tenant.

## UX
- Nurse history is a separate authenticated route; do not enlarge N01 arrival payloads
  or display clinical notes in an operational patient list.
- Nurse history detail shows complete original, immutable corrections and a clearly
  labelled form for a *new additive correction*. Show confirmation before permanent save.
- Practitioner observation detail shows original and every paged correction in temporal
  order with independent receipt state and explicit acknowledgement action.
- Never say "all received" based only on the original ACKNOWLEDGED flag.
- Error states are fail-closed; no clinical content in localStorage, URL query, logs
  or analytics. Query-string pagination numbers are not clinical content.

## Gates
- Integration tests: tenant/role/author/unit/appointment/CSRF; historical completed note;
  duplicate and conflicting idempotency; immutable SQL direct-update/delete guard;
  per-correction receipt and idempotent repeat; unit revocation; note and unrelated
  patient non-disclosure; audit metadata only.
- Frontend: typed fetch/CSRF and tested locked/error states, no synthetic data
  in deployed UI.
- GitHub Actions: PostgreSQL 16 Flyway V1-V11 + Maven verify; frontend
  lint/TypeScript/tests/build, PR CI and post-merge main CI.
- **Not waived:** clinical workflow approval, correction wording policy, privacy/legal
  review in Mozambique, threat modelling, staging, restore drill, user testing and
  incident response. Until approval, synthetic data only.

## Out of scope
Clinical protocol automation, new vital measurements or medical decision support,
cross-clinic patient history, shared notes, privileged admin clinical access, automatic
handoff notifications, general patient portal and any assumption of clinical approval.
Full Clinic Admin / SuperAdmin implementation remains last.
