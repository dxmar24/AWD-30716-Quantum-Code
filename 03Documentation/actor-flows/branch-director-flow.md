# Branch Director Flow Verification

Status: Passed

Verification source:
- Automated test: `06Code/tests/integration/actor-flows.test.js`
- Command: `npm test`
- Latest observed result: `6 passed, 6 total`, `38 passed, 38 total`

## Actor Goal
A BranchDirector should manage the assigned branch only: students, teachers, classes, attendance review and branch reports. The same user must not see or modify other branches.

## Preconditions
- BranchDirector account exists in `users`.
- The account has at least one row in `user_branch_access`.
- BranchDirector accounts created through `POST /api/v1/users` must include `branchIds`.
- First-login password change is already completed before protected operations.

## Main Flow
1. BranchDirector opens `/login.html`.
2. BranchDirector signs in with email/password or linked Google Sign-In.
3. System creates a private session.
4. BranchDirector reads branches through `GET /api/v1/branches`.
5. System returns only assigned branches.
6. BranchDirector creates students, teachers, class groups or sessions only within assigned branches.
7. BranchDirector opens `GET /api/v1/reports/branches/summary`.
8. System returns a branch summary only for assigned branches.
9. BranchDirector reviews absence justifications for assigned branch attendance.

Expected result: all branch data is scoped to `user_branch_access`.

## Alternate Flows
- Creating a student in an unassigned branch returns `403`.
- Branch summary excludes unassigned branches.
- User management endpoints return `403`.
- Audit logs return `403`.
- A BranchDirector account without branch assignment is rejected during account creation with `422 BRANCH_ACCESS_REQUIRED`.
- Invalid branch IDs return `404` before creating a partial account.

## Verified Endpoints
- `POST /api/v1/auth/google`
- `GET /api/v1/branches`
- `POST /api/v1/students`
- `GET /api/v1/reports/branches/summary`
- `POST /api/v1/absence-justifications`
- `PATCH /api/v1/absence-justifications/{id}/review`
- `GET /api/v1/users`
- `GET /api/v1/audit-logs`

## User-Facing Evidence To Capture
- BranchDirector session shown in the private dashboard.
- Branch list with only assigned branch.
- Successful student creation in assigned branch.
- Rejected student creation in another branch.
- Branch summary containing only assigned branch.
- Approved/rejected absence justification.

## Notes
During this verification, a functional gap was found and fixed: GeneralDirector can now assign branch access, and BranchDirector account creation now requires at least one assigned branch.
