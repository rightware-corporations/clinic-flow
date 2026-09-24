# CF-B9 — Clinic catalog management handoff

Baseline: main@eeb3b79a1c77e0b19f7ff9e68ab65668cfd17540.
Branch: feat/clinicflow-catalog-management.

## Delivered
- A new admin-only /catalogo page configures real clinic units and
  service definitions without direct SQL or API consoles.
- Unit and service create/edit/deactivate/reactivate use the existing
  Spring session + tenant-verified APIs with CSRF.
- Assignments and bookings already depend on these records; the
  professionals admin page now provides direct links to configure them.
- Service duration is constrained to 5–480 minutes; price and 3-letter
  currency are optional but must be entered together. No price or
  currency is invented.
- Deactivation preserves all historic records and is refused while
  any active practitioner assignment exists.
- Deactivation now also refuses while REQUESTED, CONFIRMED or
  IN_PROGRESS appointments reference the service or unit, even
  if there are no active practitioner assignments.
- Booking acquires PostgreSQL SHARE locks on the selected active
  clinic unit and service rows; catalog deactivation acquires
  UPDATE locks before conflict checks, eliminating concurrent
  booking vs catalog-deactivation races at the row boundary.
- Deactivated records can be reactivated by clinic admin; a
  conflicting name/slug is returned as HTTP 409, not hidden.

## Explicit limits
- Service duration edits do not rewrite historic appointment times.
- Existing frontend public service catalog is still a demonstration;
  it does not dynamically expose tenant data or accept public bookings.
- No DELETE endpoint for units or services.
- Organization timezone and currency policy are still unapproved;
  the UI uses an optional three-letter ISO currency.
- Manual browser and Railway staging: NOT RUN.
- Synthetic records only.

## Gates
- Frontend lint, TypeScript, Vitest and build.
- Backend Maven verify + PostgreSQL 16 + Flyway V1–V7.
- HTTP tests: admin-only creation, cross-tenant denial, reversible
  deactivation, price/currency validation and active appointment guard.
- Frontend tests: tenant and CSRF transport; admin page renders
  current server records and no fake sample catalog.
- Merge only on green CI.
