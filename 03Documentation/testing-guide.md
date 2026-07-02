# Testing Guide

Run tests from `06Code`:
```bash
npm install
npm test
```

Run the API validation report:
```bash
npm run test:api:validation
```

Run the Postman/Newman JWT evidence:
```bash
npm run postman:evidence:local
```

Current automated coverage:
- Auth/session: Google login, Postman email/password login, logout, invalid Google token, expired session, private page redirect/no-store and valid private dashboard access.
- JWT/Postman session: `/auth/login` returns `sessionToken`, Bearer token can call `/auth/me`, logout revokes the backend session, and the same token returns `401`.
- RBAC: invalid role cannot access consolidated reports.
- Rules: scholarship threshold, promotion candidate rule, teacher payment calculation.
- Academic integration: enrollment request, duplicate attendance rejection, absence review, scholarship evaluation, level promotion evaluation.

Expected result:
```text
Test Suites: 4 passed, 4 total
Tests:       16 passed, 16 total
```

Current API validation result:
```text
API validation completed: 102/102 passed.
```

Current Postman/Newman evidence:
```text
Requests:   67 executed, 0 failed
Assertions: 78 executed, 0 failed
```

Evidence files:
- `03Documentation/api-validation-report.md`
- `07Other/api-validation-results.json`
- `postman/evidence/postman-local-jwt-auth-evidence.md`
- `postman/evidence/postman-local-jwt-auth-evidence.json`

If npm reports `UNABLE_TO_VERIFY_LEAF_SIGNATURE` in a local/corporate Windows environment, configure the local certificate chain or run the install in a trusted shell configuration. Do not disable TLS verification in production.
