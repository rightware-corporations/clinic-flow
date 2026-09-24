# CF-B2 — PATIENTS CRUD HANDOFF

**Status:** implementation slice; not production approval.

## Delivered
- Flyway V2: tenant-scoped patient demographic registry.
- API: search/list, get, create, update and archive.
- No physical DELETE endpoint.
- Optimistic versioning protects updates/archive from silent last-write-wins.
- Registry access: CLINIC_ADMIN + RECEPTION.
- Archive: CLINIC_ADMIN only.
- PRACTITIONER/INTERN intentionally denied until care-relationship/supervision rules exist.
- Reads/searches and mutations are audited without copying patient payloads or search text.
- Frontend patient list/create/profile/edit/archive uses backend API; patient localStorage mock is no longer used by these screens.
- Frontend and backend tenant scope comes from verified membership/session, not arbitrary UI role selection.

## Domain boundaries
- This slice stores demographics only.
- Clinical reports and appointments are still separate demo flows.
- Generic fields use healthNumber and nationalId; no jurisdiction-specific SNS/NIF rule is frozen.
- No uniqueness rule for national/health identifiers until launch jurisdiction and semantics are defined.
- Future patient foreign keys must include tenant_id with patient_id.

## Verification gates
- Frontend: lint, typecheck, Vitest, build.
- Backend: Maven verify + Flyway V1->V2 on PostgreSQL 16.
- HTTP: cross-tenant denial, practitioner denial, stale-version 409, admin archive.
- Manual browser/local PostgreSQL: NOT RUN.
- Railway: NOT RUN.
- Real clinical data: BLOCKED pending privacy/security/operations hardening.

## Next
Professionals + unit/service assignments, then scheduling and appointments. Care relationship must be designed before practitioner patient-registry access is enabled.
