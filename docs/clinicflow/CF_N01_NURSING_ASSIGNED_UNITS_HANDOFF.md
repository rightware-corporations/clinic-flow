# ClinicFlow — CF-N01 Nursing Identity and Assigned-Unit Operations

**Implementation:** additive Flyway V9, NURSE invitations, strict assignment table, scoped operational arrivals API, dedicated nursing portal, minimal clinic-admin unit assignment controls.

## Access contracts
- A nurse is invited by an authenticated clinic admin through the existing expiring one-time token process. Invite acceptance creates the NURSE membership and nursing profile in one transaction.
- Nurses have **zero** operational patient access until an admin assigns **active units in that tenant**.
- `nursing_unit_assignments` links verified tenant nurses and tenant units. Assignments use server-side optimistic versioning, reject duplicates, invalid/foreign/inactive units, and are audited.
- `GET /api/v1/nursing/units`: only own active units; `GET /api/v1/nursing/arrivals?date=...`: only arrived patients in own active assigned units for one date, bounded to 500 rows; minimal operational appointment data.
- The nurse role never inherits the full reception queue, patient registry, or clinician report endpoints.
- Existing CLINIC_ADMIN can grant/revoke units only through `/equipa/enfermagem`; this is **minimal security provisioning**, not the final Admin dashboard.

## Frontend
- Login `NURSE` routes to `/enfermagem`; ProtectedRoute uses server-verified memberships, with localStorage only as a display cache.
- Nursing portal explicitly separates missing assignments, API errors, loading, empty queue, WAITING and CALLED.
- Unit filter is presentation-only; the backend independently enforces assigned units.
- Invitations expose Enfermagem role; admin can manage active unit assignments in a dedicated minimal provisioning screen.
- No clinical vitals, notes, triage, priority score, medication administration or medical-report access is introduced.

## Verification
- Backend integration: NURSE invite issuance/acceptance, zero assignments by default, membership, role and tenant boundaries, CSRF, foreign and inactive units, stale optimistic assignment, arrival filtering, no-report exposure and audit.
- Frontend: tenant-scoped API + CSRF, protected nursing/admin routes, fail-closed zero-assignment and error behavior, no demo data, controlled unit assignment.
- CI: frontend lint/TS/tests/build and backend Maven verify against PostgreSQL 16 including Flyway V1–V9. Actual run results must be recorded before merge.
- Staging, browser smoke, privacy/legal assessment and real patient data: **not approved / not run**.

## Subsequent work
CF-N02 should define explicit scoped nursing triage/observations, clinical review and countersign rules with separate schema and role grants; do not add medical features by assumption. Continue to implement operational portals before building the full Clinic Admin / SuperAdmin experiences.
