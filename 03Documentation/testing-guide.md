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
- Auth/session: registered Google login, unregistered Google rejection, unverified Google email rejection, Google email linking, linked-email mismatch rejection, inactive account rejection, email/password login, seeded password-hash role login, temporary password change enforcement, director-created account login, invalid branch assignment rejection, logout, invalid Google token, expired session, private page redirect/no-store and valid private dashboard access.
- JWT/Postman session: `/auth/login` returns `sessionToken`, Bearer token can call `/auth/me`, logout revokes the backend session, and the same token returns `401`.
- Cache management: public auth config cache headers, no-store session responses, private catalog memory-cache `MISS/HIT`, branch-list invalidation after writes and scoped branch report cache.
- RBAC: invalid role cannot access consolidated reports.
- Rules: scholarship threshold, promotion candidate rule, teacher payment calculation.
- Academic integration: enrollment request, duplicate attendance rejection, absence review, scholarship evaluation, level promotion evaluation.
- Python analytics: health cache headers, protected no-store responses and analytics service calculations.

Expected result:
```text
Test Suites: 5 passed, 5 total
Tests:       32 passed, 32 total
```

Current API validation result:
```text
API validation completed: 122/122 passed.
```

Current Python analytics test result:
```text
Ran 9 tests in 0.042s
OK
```

Current Postman/Newman evidence:
```text
Requests:   67 executed, 0 failed
Assertions: 78 executed, 0 failed
```

Evidence files:
- `03Documentation/cache-management.md`
- `03Documentation/api-validation-report.md`
- `07Other/api-validation-results.json`
- `postman/evidence/postman-local-jwt-auth-evidence.md`
- `postman/evidence/postman-local-jwt-auth-evidence.json`

If npm reports `UNABLE_TO_VERIFY_LEAF_SIGNATURE` in a local/corporate Windows environment, configure the local certificate chain or run the install in a trusted shell configuration. Do not disable TLS verification in production.
