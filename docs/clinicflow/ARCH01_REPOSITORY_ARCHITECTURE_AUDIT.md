# ARCH-01 — Repository architecture audit and migration plan

Status: **DRAFT / REVIEW REQUIRED**  
Baseline: `main@51be21ca7fe6af6140f686d1118533cb6376dd3d`  
Scope: architecture inventory and proposed migration only; no application-code changes.

## 1. Verified current structure

- Frontend: Vite 5, React 18, TypeScript, React Router 6; 31 route-page files under `src/pages/`. Routes, providers, transitions and role guards are wired in `src/App.tsx`.
- Shared frontend implementation: `src/components/ui`, `src/components/layout`, `src/hooks`, `src/lib/clinicflow-api.ts`; feature-specific components already exist for nursing, practitioner and reports.
- Backend: Spring Boot 4.1.1, Java **21** declared in `backend/pom.xml`; modules in `domain/{appointments,catalog,clinical,clinics,nursing,patients,practitioners,reception,scheduling}`, `platform/{audit,bootstrap,identity,security,tenancy}`, and `shared`. Flyway migrations are in `backend/src/main/resources/db/migration`.
- CI: `.github/workflows/clinicflow-ci.yml` runs Node **22** frontend checks (npm ci, ESLint, TypeScript using `tsconfig.app.json`, Vitest and build); backend uses Temurin **21**, PostgreSQL **16**, Maven verify and bootstrap disabled.
- Local audit environment reported Node 24.15.0, npm 11.12.1, Java 26.0.1, Maven 3.9.16. Local toolchain differs from CI; no change to the project Java version is authorized.

## 2. Local frontend baseline (user-provided terminal output, 2026-09-25)

| Check | Result |
|---|---|
| ESLint | 0 errors, 13 warnings |
| TypeScript | No diagnostic output observed; exact command in last run was `npx tsc --noEmit`; repeat with CI's `-p tsconfig.app.json` before any code migration |
| Vitest | 22/22 files, 60/60 tests pass |
| Vite build | Pass; 2,189 modules; main JS approximately 858.93 kB minified (247.51 kB gzip) |
| Backend local integration | Not executed in this clean local audit; remote CI is a separate result |

Existing warnings: Fast Refresh mixed exports; React hook dependencies in `WeeklyView.tsx`; invalid div-in-p nesting in `PractitionerDashboard.tsx`; React `act(...)` warnings in medical reports tests; React Router future flags; large JS chunk. Track separately; do not silently alter clinical behavior to clear warnings.

Local `git status` showed untracked `backend/target/`. The GitHub baseline `.gitignore` does not include it; separate draft PR #20 adds `/backend/target/`. Local .gitignore may differ; verify before reconciling. Never commit Maven build output.

## 3. Security and clinical invariants

- `src/lib/clinicflow-api.ts` is the typed same-origin API entry point. Spring session, CSRF, and server-verified tenant membership remain authoritative. Tenant calls use `X-Clinicflow-Tenant`; mutation calls carry CSRF.
- `ProtectedRoute` calls `/api/v1/me` and maps server memberships to legacy frontend roles; localStorage's `user` value is display-only compatibility, **not** an authorization source.
- `src/App.tsx` has public routes and protected role-specific routes. Preserve every path, role constraint, redirect and session-error behavior exactly. The `/super` route currently uses `allowedRoles={["platform"]}` while the API membership type lists no platform role: flag as an unresolved contract discrepancy; do not grant a new role or invent access.
- Preserve clinic/tenant isolation, patient-data handling, read-only clinical handoff behavior, migrations and REST contracts. No new clinical functionality is in scope.

## 4. Proposed frontend organization (not implemented)

```text
src/
  app/
    routes/
    providers/
  features/
    public-site/
    auth/
    administration/
    appointments/
    reception/
    nursing/
    practitioner/
    patients/
    clinical-reports/
    staff/
    intern/
    platform/
  shared/
    components/ui/
    components/layout/
    hooks/
    lib/
    types/
  assets/
  test/
```

Do not move `backend/` or introduce `apps/web` / `apps/api` merely for aesthetics. Preserve `src/lib/clinicflow-api.ts` until an explicit endpoint-to-consumer map justifies splitting it. Avoid cross-feature imports; common UI belongs in `shared`, not a random feature.

## 5. Proposed execution order and gates

1. **ARCH-01 documentation** (this PR): record actual file/route/import inventory and baseline. No code migration.
2. **ARCH-02 routing seam** (separate PR): extract route declarations/providers from `App.tsx` without modifying URL paths, role gates, error states, or behavior. Add route-coverage tests first, including unauthorized and cross-role access.
3. **ARCH-03 public-site migration** (separate PR): move public-only pages and home components incrementally; update all imports and tests. Keep public booking integrated with the existing API.
4. **ARCH-04 domain migrations** (separate small PRs): auth, administration, reception, nursing, practitioner, patients and reports. Migrate each with its own tests. Treat nursing and practitioner clinical handoff as high-risk.
5. **ARCH-05 shared/API rationalization**: only after dependency evidence; preserve session, CSRF and tenant headers. Introduce lazy route loading only with measured behavior and loading/error tests.

Every code PR must pass `npm ci`, `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run build`, and CI backend `mvn verify` against PostgreSQL 16. Record PASS/FAIL/NOT RUN. Compare routes and role permissions before/after. No destructive Git commands, implicit merge, production rollout or clinical sign-off in this architecture track.

## 6. Open verification items

- Resolve local `.gitignore` divergence before cherry-picking PR #20 or merging audit branches.
- Inspect complete imports and API consumers before physical moves; the console output truncated import lines.
- Confirm the `/super` role contract with product/security owners; do not infer authorization.
- Triage npm dependency vulnerabilities separately, without `npm audit fix --force`.
- Obtain clinical, privacy/legal, security, staging and restore-test approvals independently before real patient-data use.

**Handoff:** READY FOR ARCHITECTURE REVIEW; NOT READY FOR AUTOMATIC CODE MIGRATION.
