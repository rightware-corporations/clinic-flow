# CF-B4 — SCHEDULING ENGINE FOUNDATION

**Status:** implementation slice. Not production approval.

## Delivered
- Flyway V4 weekly practitioner availability rules.
- Clinic-local schedule blocks.
- Tenant-scoped, admin/practitioner-owner schedule management.
- Deterministic slot preview based on:
  - active professional profile;
  - professional↔unit assignment;
  - professional↔service assignment;
  - service duration;
  - weekly availability rule;
  - schedule blocks.
- Overlapping active weekly rules are rejected at application level.
- No Math.random is used by the backend scheduling source of truth.
- Audit events for rule/block changes.

## Deliberately not included
- Appointments and booking transaction.
- Double-booking database exclusion/locking.
- Public anonymous scheduling endpoints.
- "Any practitioner" selection.
- Clinic timezone configuration.
- Redis cache.

## Time semantics
V4 stores availability and blocks in clinic-local wall time. This is suitable for
the current single-jurisdiction internal foundation but NOT a production freeze.
Organization timezone must be introduced before external/public booking and
before converting appointment instants for notifications/integrations.

## Verification gates
- Flyway V1 -> V4 on PostgreSQL 16.
- Rule overlap rejection.
- Block exclusion from generated slots.
- Cross-tenant denial.
- Frontend gates remain mandatory although this slice does not yet replace BookingPage.
- Manual browser/local DB: NOT RUN.
- Railway: NOT RUN.

## Next
CF-B5 appointments:
1. tenant-scoped appointment aggregate;
2. command transitions;
3. database-backed anti-double-booking;
4. idempotent create/reschedule;
5. real frontend booking integration;
6. only then remove the random/mock slot generator from public UI.
