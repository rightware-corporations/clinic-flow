# CF-B8 — Operational dashboard truthfulness and privacy gate

Baseline: main@cb7f45390979a7cb0f1ab6b3510f207476166d60.
Branch: feat/clinicflow-real-role-dashboards.

## Scope

Replaces demo/mock data and simulated mutations on all five authenticated
role dashboards. This does NOT claim deployment readiness.

- **Admin**: tenant-authorized real patient count, active service/professional
  counts and today's appointment summary. No access to report content or to
  the old localStorage report store from the admin dashboard.
- **Reception**: today's real calendar + authorized patient search via API.
  Links to the existing real appointment and patient-registry workflows.
- **Practitioner**: server-enforced own calendar + own report index; start,
  complete and other appointment mutations remain on the real /marcacoes
  workflow. The old UI-only schedule-block action has been retired here
  rather than pretending to create server-side blocks.
- **Intern**: explicit disabled clinical features until care supervision,
  relationship and audit requirements are approved. No demo patient/report data.
- **Patient**: explicit disabled chart, appointment and result features until
  a verified account-to-patient link and disclosure policy are built.
  No dummy consultations presented as belonging to the signed-in user.
- The patient sidebar calls /agendar "Simular agendamento": the public booking
  page has no persistence and remains an explicit demonstration.
- The historical medical-reports-store and legacy report components are kept
  quarantined for follow-up inventory, NOT silently deleted: older localStorage
  entries may contain user-entered content and require an explicit migration /
  deletion policy.

## Server authorization

Existing API role/tenant checks remain authoritative. These dashboards
do not grant any privilege. Admin/reception cannot query private clinical
report endpoints. Clinicians' appointment list is owner-filtered by backend.
Patient/intern endpoints for medical records remain unimplemented, not mocked.

## Current limits

- The date of "today" is derived from the current browser device because
  organization timezone configuration is not finalized. Explicit UI notice.
- GET /api/v1/appointments returns at most 1000 entries per range; if a tenant
  grows to exceed that limit, the dashboard counts need a dedicated
  server-side aggregation endpoint. No trend or growth number is fabricated.
- Browser/local PostgreSQL smoke test and Railway staging: NOT RUN until
  independently executed.
- Synthetic data only; privacy/legal, restore testing and operational
  controls remain production gates.

## Evidence / gates

- Frontend lint, TS, Vitest and build.
- Backend Maven verify with PostgreSQL + Flyway V1–V7 (no backend source changed).
- UI tests for API-only metrics, staff search, practitioner-owned report
  summaries, absent patient/intern medical content and rejection of mock
  localStorage report entries.
- Merge only if all CI gates pass.
