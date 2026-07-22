# Postman Defense Guide

## Import

Import these files:

1. `American-Latin-Class.postman_environment.json`
2. `American-Latin-Class-API.postman_collection.json`
3. `American-Latin-Class-Analytics-API.postman_collection.json`

The committed environment targets the local defense services:

- Site: `http://127.0.0.1:3005`
- Node API: `http://127.0.0.1:3005/api/v1`
- Python analytics: `http://127.0.0.1:8005/api/analytics/v1`

Secrets and generated IDs are intentionally blank. Put the General Director email and password in Postman's **Current value**, never Initial/shared value.

Start the local Mailpit service with `npm run db:local:up`. The environment already points `mailpit_url` to `http://127.0.0.1:8025`. The account lifecycle folder reads the captured invitation from Mailpit to test first login while also asserting that `/users` never returns the temporary password.

## Main Collection

The collection contains 105 requests organized in execution order and covers all 86 declared Express route contracts:

1. Health And Public
2. Authentication And Session
3. Enrollment Requests
4. Catalog And Academic Resources
5. Identity And Access
6. Attendance And Absences
7. Events
8. Payments
9. Reports
10. Student Self Service
11. Session Teardown

Login saves `data.sessionToken` as `session_token`. Collection-level Bearer authorization then protects subsequent requests. Dynamic dates and generated IDs allow a complete academic flow without hard-coded fixture identifiers.

Run the complete collection to show 105 requests and 135 assertions without failures. The last requests log out and prove that the revoked token returns `401`.

From `06Code`, run `npm run postman:coverage` to compare the collection against the Express router automatically. The current result is 86/86 declared route contracts represented.

## Python Analytics Collection

Keep the Node login token active, then run the six analytics requests. They prove:

- anonymous access is rejected;
- attendance risk and scholarship readiness work for a persisted student;
- branch performance and teacher workload read the same PostgreSQL database;
- the Python service accepts the Node-issued session only while it remains active.

## Automated Evidence

From `06Code`:

```powershell
npm run postman:evidence:local
npm run postman:evidence:analytics
```

Outputs:

- `postman/evidence/postman-local-jwt-auth-evidence.md`
- `postman/evidence/postman-local-jwt-auth-evidence.json`
- `postman/evidence/python-analytics-api-evidence.md`
- `postman/evidence/python-analytics-api-evidence.json`

`scripts/sync-postman-defense-collection.js` is the structural source used to synchronize the expanded collection. Do not manually commit passwords, Google ID tokens, session tokens or private database values.
