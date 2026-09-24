# ClinicFlow Backend — CF-B1 (in progress)

**Status:** Foundation slice only. Not deployable with real patient data. Frontend login and route verification have been wired to the real session API on the foundation branch; the remaining clinical pages still contain mock/demo content and must not be deployed with real patient data.

## Stack
- Java 21, Spring Boot 4.1.1, Maven, Spring Security
- PostgreSQL (authoritative), Flyway; JDBC with explicit tenant-scoped SQL
- HttpOnly session cookie + CSRF; no Docker required locally
- Redis planned, intentionally not required for this first slice

## Local Windows setup (8 GB RAM, no Docker)

Install JDK 21, Maven and native PostgreSQL. Create a **dedicated, least-privilege** database user and database named clinicflow. In a PowerShell terminal, set environment values (use your own strong secrets, never commit them):

```powershell
$env:SPRING_PROFILES_ACTIVE = "local"
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://localhost:5432/clinicflow"
$env:SPRING_DATASOURCE_USERNAME = "clinicflow"
$env:SPRING_DATASOURCE_PASSWORD = Read-Host "PostgreSQL password"
$env:CLINICFLOW_BOOTSTRAP_ENABLED = "true"
$env:CLINICFLOW_BOOTSTRAP_EMAIL = "admin@example.test"
$env:CLINICFLOW_BOOTSTRAP_PASSWORD = Read-Host "Initial admin password (min. 14 chars)"
$env:CLINICFLOW_BOOTSTRAP_CLINIC = "ClinicFlow Demo"
mvn -f backend/pom.xml spring-boot:run
```

On successful bootstrap, retain the generated tenant UUID from the server log. **Stop the process, unset bootstrap credentials and set CLINICFLOW_BOOTSTRAP_ENABLED=false**, then restart. Do not use this bootstrap in public production.

The API runs at http://localhost:8081. Vite runs at http://localhost:8080 and proxies `/api` to the backend. Do not set the `local` profile in public environments. The default cookie is Secure; only the local profile permits plain HTTP.

### Session + CSRF flow

1. `GET /api/v1/auth/csrf`, saving the session cookie. Response includes `header` and `token`.
2. `POST /api/v1/auth/login` as URL-encoded form fields `email`, `password`, with the CSRF header, saving cookies. No self-registration or selectable admin role.
3. **Fetch a fresh CSRF token after login**; login rotates the session/CSRF token.
4. `GET /api/v1/me` returns memberships and clinic IDs.
5. Send `X-Clinicflow-Tenant: <membership.tenantId>` on scoped CRUD routes. Backend rechecks current membership and clinic status on every request.
6. `POST /api/v1/auth/logout` with a fresh CSRF header; session is invalidated.

### Implemented initial CRUD (tenant-scoped)

- `GET/POST /api/v1/clinic-units`
- `GET/PUT /api/v1/clinic-units/{id}`
- `POST /api/v1/clinic-units/{id}/deactivate`
- `GET/POST /api/v1/services`
- `GET/PUT /api/v1/services/{id}`
- `POST /api/v1/services/{id}/deactivate`

Read access requires active membership; write access requires CLINIC_ADMIN in that tenant. Commands are audited in the same DB transaction. No direct DELETE of historical clinical resources. Pricing is typed NUMERIC + ISO currency code.

### Tests

CI executes `mvn -B -f backend/pom.xml verify` against an **ephemeral PostgreSQL 16 GitHub Actions service**. This does not require Docker on the development laptop. Local integration tests require local PostgreSQL and appropriately configured SPRING_DATASOURCE_* env variables.

### Railway deployment contract (do not deploy before gates)

Deploy backend from repository subdirectory `/backend`, install Java 21 and Maven; build `mvn -B -DskipTests package`, run `java -jar target/clinicflow-backend-0.1.0-SNAPSHOT.jar`. Add a Railway PostgreSQL service and map its **private** PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD into SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME and SPRING_DATASOURCE_PASSWORD. Set SESSION_COOKIE_SECURE=true and CLINICFLOW_BOOTSTRAP_ENABLED=false; health path is `/actuator/health`.

**Important:** initial login uses in-memory HTTP sessions and same-origin frontend proxy. Do not horizontally scale or expose cross-site frontend until shared session strategy and domain routing have been finalized. Railway project, credentials, costs, DNS, and privacy review remain pending. Never use production patient data during this phase.

## Pending slices
- Validate real LoginPage + ProtectedRoute end-to-end against a live backend; public registration was disabled.
- Patients CRUD with care-relationship access.
- Scheduling, appointment transaction/conflict constraints.
- Clinical reports, immutable finalization and correction history.
- Redis (cache/rate limiting), audit of clinical reads, external notification adapters.
