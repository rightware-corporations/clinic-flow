# CF-B6B — CLINICAL REPORTS FRONTEND HANDOFF

Baseline: main@3490420712eeed43c0c4ab4635ddc6a3435b3939.
Branch: feat/clinicflow-clinical-reports-web.

## What changed

- /relatorios now requires a verified PRACTITIONER role, matching the backend.
  Admin and intern sidebar links have been removed; no elevated clinical-content
  privileges are inferred from administrator membership.
- The production-facing reports route no longer calls the legacy
  localStorage-based medical-reports-store. It reads the clinician-owned index
  and individual report details from /api/v1/clinical-reports only.
- The new-report picker calls /eligible-appointments: only this clinician's
  started/completed encounters that have no original report can be selected.
  The practitioner is NOT granted access to the general patient registry.
- Forms use existing design-system controls. Report types are consultation,
  diagnostic and follow-up; there is NO prescription generation in CF-B6B.
- Creating/editing saves a DRAFT first; a separate explicit confirmation
  finalizes it, preventing frontend claims before backend confirmation.
- Finalized originals display immutable read-only content. Permanent adendas
  use the same UUID idempotency key for retries; UI resets the key if content
  changes. A confirmation explains the permanent effect.
- Clinical text is React component state and transient query memory; no clinical
  report data is intentionally persisted to localStorage/sessionStorage by
  this route. The tenant ID alone remains in sessionStorage.
- Existing localStorage records are deliberately NOT silently uploaded or
  deleted: the historical demo store might contain user-entered material.
  Legacy store modules remain quarantined pending explicit retirement/migration.
- The report index is server-paginated (30 per page) and filters/searches the
  current page only; this is explicit in the UI.

## Security and integrity

- Client-side role gating is UX only; backend verifies active clinician
  membership, ownership, appointment relationship and tenant at every call.
- The /eligible-appointments endpoint only returns minimum patient identity
  for directly assigned encounters and audits access without clinical payload.
- All medical content stays out of generic audit events.
- Browser printing, PDFs, supervisor/emergency overrides, prescriptions and
  patient portal access are NOT claimed as production-ready.

## Gates

- Backend Flyway V1–V6 + HTTP integration suite, including the new eligible
  encounter endpoint role and owner restrictions.
- Frontend lint, TS, Vitest, build, UI test that old localStorage records cannot
  appear on the real report route, API tests for tenant and CSRF/idempotency.
- Manual browser + native PostgreSQL: NOT RUN.
- Railway staging + restore and privacy review: NOT RUN.

## Next slice

A dedicated role/permission and invitation module followed by demo-retirement,
timezone policy, privacy hardening and real staging smoke tests. Synthetic data
only; not approved for live clinical records.
