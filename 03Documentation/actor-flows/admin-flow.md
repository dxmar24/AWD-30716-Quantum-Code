# Admin Flow Verification

Status: Passed

Verification source:
- Automated test: `06Code/tests/integration/actor-flows.test.js`
- Command: `npm test`
- Latest observed result: `6 passed, 6 total`, `38 passed, 38 total`

## Actor Goal
Admin should keep full system governance: role changes, branch access governance, catalog and branch management, audit visibility and global reports.

## Preconditions
- Admin account exists in `users`.
- Password change is completed.
- Admin has global access by role.

## Main Flow
1. Admin opens `/login.html`.
2. Admin signs in with email/password or linked Google Sign-In.
3. System creates a private session.
4. Admin lists users through `GET /api/v1/users`.
5. Admin changes a user role through `PATCH /api/v1/users/{id}/role` only when the target user already has the required profile or branch scope.
6. Admin assigns branch access to BranchDirector users through `PATCH /api/v1/users/{id}/branch-access`.
7. Admin creates or updates academic catalog records.
8. Admin creates branches and reviews global reports.
9. Admin reads audit logs.

Expected result: Admin has full global control and can perform governance actions that are restricted from other roles.

## Alternate Flows
- Invalid role values return `422`.
- Invalid branch access IDs return `404`.
- Student and Teacher role changes without linked profiles return `422`.
- Branch access assignment to a non-BranchDirector user returns `422`.
- Duplicate business records still follow normal conflict rules, such as duplicate attendance returning `409`.
- Admin-created temporary users must still change their password before protected academic flows.
- Admin can use Google Sign-In only through a registered and verified academy email.

## Verified Endpoints
- `POST /api/v1/auth/login`
- `GET /api/v1/users`
- `PATCH /api/v1/users/{id}/role`
- `PATCH /api/v1/users/{id}/branch-access`
- `POST /api/v1/branches`
- `GET /api/v1/reports/branches/summary`
- `GET /api/v1/audit-logs`

## User-Facing Evidence To Capture
- Admin login.
- User role update.
- Branch access update.
- Branch creation or catalog creation.
- Audit log list.
- Global branch report.

## Notes
Admin remains the only role that can change existing user roles. GeneralDirector can create users and assign branch access, but cannot mutate role assignments after account creation.
