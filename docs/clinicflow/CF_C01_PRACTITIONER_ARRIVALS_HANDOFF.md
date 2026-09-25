# CF-C01 — Reception-to-Practitioner Handoff

**Scope:** Read-only reception arrival signals for the practitioner assigned to each appointment, building on CF-R01. No new schema, new clinical grant or queue mutations.

## Backend contract
- `GET /api/v1/practitioner/arrivals?date=YYYY-MM-DD` requires an authenticated `PRACTITIONER` with an active membership in the requested clinic.
- Database joins `reception_checkins` to `appointments` using both tenant and appointment identifiers, then filters `a.practitioner_user_id = authenticated user`.
- Only `appointmentId`, `queueStatus`, `arrivedAt` and `calledAt` are returned. No demographic or clinical report contents.
- Appointment date window is one day; max 1000 rows; successful reads write audit events without PHI payload.
- RECEPTION, CLINIC_ADMIN, INTERN and PATIENT roles do not receive access to this specific clinician endpoint.
- The clinician cannot call or alter queue entries; check-in does not initiate clinical treatment.

## UI
- Existing `/profissional` displays a separate arrival status for confirmed assigned appointments: "Sem chegada registada", "Chegada registada" or "Chamado pela recepção".
- A failed arrival request shows "Estado de chegada indisponível", never a misleading no-arrival message, and must not hide the existing appointment/report dashboard.
- Manual refresh updates both dashboard and arrival data; arrival query refreshes every 30 seconds while the page is active.
- Treatment start/completion remains in the existing authorized appointment workflow.

## Verification and deferred work
- Backend tests cover own/other doctor filtering, role access, foreign tenant denial, no-auth denial, date restriction, waiting/called stages, minimal payload and audit records.
- Frontend tests cover the typed endpoint and role-dashboard arrival status/failure behavior.
- CI frontend (lint, TypeScript, tests, build) and backend (PostgreSQL 16, Flyway, Maven verify) are required for integration.
- Staging/browser smoke, clinical authorization audit, backup/restore, privacy/legal readiness: not completed. **Synthetic data only.**
- Implement Nurse identity and scoped triage as a subsequent operational slice. Full Clinic Admin and global SuperAdmin screens remain last in implementation order.
