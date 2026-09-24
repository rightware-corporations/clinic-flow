# CF-B7 — Secure user invitations and onboarding

Baseline: main@a737a5172abd6ecf020a68fddba927e195bfffe1.
Branch: feat/clinicflow-secure-invitations.

## Scope

This slice replaces direct/manual database account creation for ordinary clinic
staff with a controlled invitation workflow.

### Administrator
- Only a verified CLINIC_ADMIN may issue or revoke tenant invitations.
- Allowed invitation roles are RECEPTION, PRACTITIONER and INTERN.
- CLINIC_ADMIN and PATIENT cannot be granted through this flow.
- Existing active memberships are rejected.
- Only one live invitation per tenant/email is allowed.
- Expired invitations are terminalized before a replacement is issued.
- The administrator receives the raw token exactly in the create response.
  PostgreSQL stores only its SHA-256 hash.
- The frontend renders the raw link once and does not persist it.

### Recipient
- Public invitation inspection requires possession of the random 256-bit token.
- The SPA receives the token in the URL fragment (/convite#token), which is not
  transmitted in the HTTP request or Referer. The page consumes it into memory
  and removes the fragment from the visible browser URL.
- API calls place the token in X-Clinicflow-Invitation, never in the API path.
- Invitation acceptance remains protected by Spring CSRF.
- A new account requires a password of at least 14 characters.
- If the email already belongs to a ClinicFlow account, the invite cannot reset
  its password. The recipient must prove the existing account password; then a
  new tenant membership is added to the same user.
- Tokens are single-use, expire by default after 72 hours and can be revoked.
- No raw token is written to audit_events.

## Delivery

Email delivery is deliberately NOT implemented in CF-B7. The administrator
copies the one-time invitation link and sends it through an appropriate channel.
An email adapter can be added later without weakening the token model.

## Verification gates

Backend integration tests:
- invitation role escalation rejection;
- raw token is not stored in PostgreSQL;
- anonymous inspection;
- CSRF rejection on acceptance without token;
- successful new account + exact tenant role;
- replay returns gone;
- cross-tenant administration denial;
- existing-account password proof without reset;
- expiry + safe reissue.

Frontend:
- token remains out of API URL;
- acceptance sends CSRF and invitation header;
- admin list remains tenant-scoped;
- /convite consumes and removes the URL fragment.
- lint / TypeScript / Vitest / production build.

## Explicit production blockers

- Automatic email delivery, bounce handling and invitation resend UX.
- Rate limiting / brute-force protection at edge/application boundary.
- Password recovery and MFA.
- Organization-wide role mutation / membership suspension UI.
- Railway staging, backup restore rehearsal, privacy and threat-model review.

Synthetic data only until the wider production hardening programme is complete.
