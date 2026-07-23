# Testing Guide

All defense verification can run locally while AWS remains stopped.

## Complete Commands

From `06Code`:

```powershell
npm test
npm run test:api:validation
npm run frontend:build
npm run postman:coverage
npm run postman:evidence:local
npm run postman:evidence:analytics
```

From `06Code/apis/python-analytics-api`:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

The analytics evidence command requires both local services and PostgreSQL. The main Postman evidence command starts an isolated in-memory test server automatically.

## Current Verified Results

Verified on July 21, 2026:

| Verification | Result |
| --- | --- |
| Node unit/integration suites | 11 suites, 91 tests passed |
| API HTTP validation | 134/134 checks passed |
| React production build | Successful |
| Main Postman/Newman collection | 105 requests, 135 assertions, 0 failures; all 86 Express routes represented |
| Postman route inventory | 86/86 declared Express route contracts represented |
| Python unit/API tests | 15 tests passed |
| Python analytics Postman/Newman | 6 requests, 12 assertions, 0 failures |
| npm dependency audit | 0 known vulnerabilities |

## Coverage

- Auth/session: password and Google linking, verification, first-login change, logout, expiry and revoked sessions.
- Authorization: role checks plus student, teacher and branch resource scope.
- Account lifecycle: create, reset, deactivate, reactivate, role and branch access.
- Academic integrity: enrollment capacity/history, session overlap/lifecycle, exact roster, draft/final attendance, corrections and justifications.
- Finance/rules: charges, reversals, scholarships, promotion and teacher pay.
- Reports: general, branch and attendance calculations, filters, cutoff dates, immutable inputs and data-quality alerts.
- Cache: public, private, no-store, memory HIT/MISS and invalidation.
- Python analytics: token/session validation, resource scope, calculations and cache headers.
- Actor workflows: Visitor, Student, Teacher, Branch Director, General Director and Administrator.

## Evidence Files

- `03Documentation/api-validation-report.md`
- `07Other/api-validation-results.json`
- `postman/evidence/postman-local-jwt-auth-evidence.md`
- `postman/evidence/python-analytics-api-evidence.md`
- `07Other/visual-evidence/defense/`

Test mode forces the in-memory repository through `06Code/backend/tests/setup-env.js`, so Jest never changes the local or cloud PostgreSQL database.
