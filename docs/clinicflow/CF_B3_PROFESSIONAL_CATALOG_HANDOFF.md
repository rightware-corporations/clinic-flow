# CF-B3 — Professional Catalog Execution Handoff

**Baseline:** main @ 73e5da90338c92a911441827f887bc54dd7f01a0.
**Branch:** feat/clinicflow-professionals-catalog.
**Status:** implementation and automated verification only, not a clinical-data deployment approval.

## Delivered
- Flyway V3: tenant-scoped specialties, professional profiles and associations with clinical units and services. Composite foreign keys enforce tenant consistency at database level.
- Existing active PRACTITIONER or INTERN membership is required before adding a professional profile. This block never generates passwords or self-assigns roles.
- Clinic admin can create, read, update and deactivate/reactivate profiles, with optimistic versions on profile mutations.
- Clinic admin can create, rename, deactivate/reactivate tenant specialties.
- Professional reads: clinic admin may list and read; practitioner may only read their own profile. Account eligibility is admin-only.
- Changes and status transitions write transactional audit events.
- Active assigned specialties, services and units cannot be deactivated (409). Profile reactivation fails when assigned unit/service/specialty is inactive.
- /profissionais is an admin-only frontend catalog using real API calls, with specialty management, eligible existing members and unit/service assignments.

## Validation
CI frontend: npm ci, lint, TypeScript, Vitest, build. CI backend: Maven verify, Flyway V1–V3 and real PostgreSQL 16 integration tests (no Docker on the development computer).

Manual browser/local PostgreSQL and Railway deployment: NOT RUN.
Real patient data: BLOCKED pending clinical privacy, security and operations gates.

## Deferred
Secure invitations/account onboarding, practitioner licence verification, real scheduling conflict checks, appointment state workflow, notifications, Redis performance cache, clinic-specific branding and production hardening.

## Next
CF-B4 user onboarding/invitations, then CF-B5 scheduling/real appointment workflow. Existing public website and appointment pages still contain demonstration content; do not promote them as operational.
