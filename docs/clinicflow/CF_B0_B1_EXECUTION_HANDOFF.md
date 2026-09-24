# CF-B0 / CF-B1 — Implementation handoff

Date: 2026-09-24. Baseline: main @ 9c7db71fbf7b1e1c2dbff9e8b38ca0413d1020ec.
Branch: feat/clinicflow-foundation-identity-tenancy.

## B0 audit (focused, verified)

The main branch has 120 blobs, no backend and no GitHub Actions workflow at audit time.
Frontend: Vite + React + TS. Pages exist for patient, staff, practitioner,
administrator, units, services, appointments and medical reports. Login derives
role from ID prefix and stores an editable user object in localStorage.
ProtectedRoute trusts this object; medical reports and patients use localStorage;
slot occupancy uses Math.random. None of those are acceptable production controls.
The existing frontend has not yet been migrated or exhaustively tested.

## Decisions used for B1 only
- Modular monolith; Java 21 + Spring Boot 4.1.1.
- PostgreSQL via Flyway, DB per environment, explicit tenant_id scoping.
- User may hold one role per tenant initially, changeable with a future migration.
- One tenant may hold many clinic units; patient cross-tenant identity remains undecided.
- Session + HttpOnly cookie + CSRF; Vite reverse proxy in local development.
- No local Docker; CI's remote PostgreSQL service runs integration tests.
- Redis NOT in initial runtime; later when a real cache, rate-limiting or shared-session need exists.
- Initial operator-only bootstrap via temporary environment configuration; never permit
  public signup as clinic admin. Bootstrap disabled by default.
- No product customization, production launch or real patient data in this slice.

## Delivered in the foundation change
- Maven backend, Flyway V1, health, login/logout/csrf/me.
- Membership-verified tenant access, ClinicUnit and ServiceDefinition CRUD.
- Audit events for domain mutations in the same transaction.
- PostgreSQL integration tests for isolation and uniqueness.
- CI workflow for frontend and backend.
- Vite development reverse proxy, real LoginPage + ProtectedRoute, server-side profile update, no Docker.

## Incomplete / blocking
- NOT production-ready: frontend session integration is implemented but requires manual end-to-end smoke tests; all clinical dashboards and medical reports still use demonstration data.
- No per-clinic onboarding, staff invitations, patient or appointment CRUD yet.
- No scheduling concurrency tests or clinical data storage yet.
- Full security, cookie domain, rate limits and Railway deployment not tested.
- Do not merge until CI results inspected. Do not deploy with real patient data.

## Next mission
1. Resolve any CI failures in this foundation PR.
2. Run and verify the wired frontend login, route protection, logout and profile edit against the local backend.
3. Validate real end-to-end login and tenant-specific dashboards.
4. Implement authorised patients CRUD, then services/professionals and scheduling.
5. Persist actual PASS/FAIL/NOT RUN gates and update this handoff every slice.
