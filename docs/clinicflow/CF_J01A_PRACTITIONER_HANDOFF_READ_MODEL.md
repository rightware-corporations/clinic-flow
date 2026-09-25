# ClinicFlow — CF-J01A: Practitioner Handoff Read Model

**Status:** Draft PR #18 — implementation candidate, not approved for patient data.  
**Baseline:** `main@0333baedafff4f4e46194970573bc8d159cebc31` (includes master handoff PR #17).  
**Branch:** `feat/cf-j01a-practitioner-handoff-read-model`.  
**Source contract:** Fase C `CF_J01_OPERATIONAL_HANDOFF_CONTRACT.md` and `CF_J01_HTTP_SQL_PROPOSAL.md` (RIGHTWARE Drive).

## Scope actually implemented
- `GET /api/v1/practitioner/handoffs/{appointmentId}`.
- Aggregate *only* existing V5 appointment, V8 reception check-in, V10 published nursing note and V11 immutable nursing corrections in one PostgreSQL SELECT.
- SQL requires verified tenant, active PRACTITIONER membership and profile, and **current assignment of the appointment**.
- No clinical content, names, symptom notes or vital signs are returned. Original nursing `DRAFT` and no published note have identical external indicators.
- Per-correction receipt is separate from original receipt, and new unacknowledged addenda reopen the projected pending state.
- GET writes **only a metadata audit event** (`PRACTITIONER_HANDOFF_VIEWED` / `Appointment`) in the same transaction; it does not acknowledge, finalize or change an existing clinical/operational resource.
- Response disables caching (`private, no-store`) and varies by Cookie and tenant header; database failures surface as HTTP 503, never a fabricated absence.

## Indicator semantics

| Indicator | Meaning | Does **not** mean |
|---|---|---|
| `NO_CHECK_IN` | No recorded reception arrival and no published note | Patient physically absent |
| `NO_SUBMITTED_NOTE` | Check-in exists but no note published to the practitioner | Nursing failure; hidden draft |
| `ORIGINAL_RECEIPT_PENDING` | Nursing original published, not acknowledged | Critical result or urgency |
| `CORRECTION_RECEIPTS_PENDING` | Original received but at least one later correction lacks individual receipt | Automatic medical validation |
| `ALL_RECEIPTS_RECORDED` | Original and all existing corrections have receipt timestamps | Care complete or patient safe for discharge |
| `INCONSISTENT` | Contradictory projected metadata | Safe negative state |
| HTTP 503 | Database source unavailable | No outstanding work |

In case `SUBMITTED` original also has unacknowledged corrections, the primary indicator remains `ORIGINAL_RECEIPT_PENDING` while the correction count remains visible independently.

## Security and test coverage
Integration tests cover own and non-assigned clinician, wrong clinical/admin roles, foreign tenancy, absent session, draft invisibility, no-arrival, published note, initial receipt, late corrections, partial receipt, repeated reads without side effects, cancelled appointment, inactive clinician profile and suspended organization. A dedicated unit test covers contradictory snapshots and source outage → 503.

All tests use fully synthetic fixtures and PostgreSQL 16 in CI. No change to V1–V11 migrations, existing reception/nursing controllers, frontend routes or clinical permissions.

## Out of scope and remaining gates
- CF-J01B indicator in the existing practitioner portal: **not implemented here**.
- No true configurable Journey Engine, no lab orders, no BPMN or FHIR claim, no clinical task escalation or forced nursing step.
- Source availability, audit and access remain separate from automatic clinical decisions. Acknowledgement is **receipt only**, never countersigning or clinical validation.
- Merge requires branch and PR CI review. Browser smoke, Railway staging, patient-data privacy/legal review in Mozambique, threat modelling, backup/restore drill, incident response and clinician workflow sign-off remain **NOT RUN / BLOCKED**.
- Full Clinic Admin / SuperAdmin portals remain last; their minimal existing provisioning remains unchanged.
