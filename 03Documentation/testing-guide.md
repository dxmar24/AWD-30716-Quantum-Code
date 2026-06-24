# Testing Guide

Run tests from `06Code`:
```bash
npm install
npm test
```

Current automated coverage:
- Auth/session: login, logout, invalid Google token, expired session, private page redirect/no-store and valid private dashboard access.
- RBAC: invalid role cannot access consolidated reports.
- Rules: scholarship threshold, promotion candidate rule, teacher payment calculation.
- Academic integration: enrollment request, duplicate attendance rejection, absence review, scholarship evaluation, level promotion evaluation.

Expected result:
```text
Test Suites: 4 passed, 4 total
Tests:       13 passed, 13 total
```

If npm reports `UNABLE_TO_VERIFY_LEAF_SIGNATURE` in a local/corporate Windows environment, configure the local certificate chain or run the install in a trusted shell configuration. Do not disable TLS verification in production.
