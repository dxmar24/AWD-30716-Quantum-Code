# General Director Flow Verification

Status: Passed

Verification source:
- Automated test: `06Code/backend/tests/integration/actor-flows.test.js`
- Command: `npm test`
- Latest observed result: `11 passed, 11 total`, `91 passed, 91 total`

## Actor Goal
The GeneralDirector should operate as the academy owner: create accounts, assign branch access, review global academic activity and keep visibility over branches, users and reports.

## Preconditions
- GeneralDirector account exists in `users`.
- Password change is completed before protected operations.
- Branch records exist.

## Main Flow
1. GeneralDirector opens `/login.html`.
2. GeneralDirector signs in with email/password or linked Google Sign-In.
3. System creates a private session.
4. GeneralDirector lists users through `GET /api/v1/users`.
5. GeneralDirector creates a user through `POST /api/v1/users`.
6. If creating a Student or Teacher, GeneralDirector includes the linked academic profile payload.
7. If creating a BranchDirector, GeneralDirector assigns at least one branch in `branchIds`.
8. GeneralDirector reviews or replaces BranchDirector branch access through `/api/v1/users/{id}/branch-access`.
9. GeneralDirector reads permissions and branch reports.
10. GeneralDirector reads audit logs.

Expected result: GeneralDirector can manage academy accounts and branch scopes without needing technical Admin access.

## Alternate Flows
- Creating a BranchDirector without `branchIds` returns `422 BRANCH_ACCESS_REQUIRED`.
- Creating a Student or Teacher without the matching profile payload returns `422`.
- Creating an Admin account as GeneralDirector returns `403 ADMIN_ROLE_RESTRICTED`.
- Assigning a non-existent branch returns `404`.
- GeneralDirector can create users and branch access, but cannot change existing user roles through `PATCH /api/v1/users/{id}/role`; that action remains Admin-only.
- Created users receive the temporary password through a branded email and must change it before protected academic flows. The director sees only the delivery confirmation.
- Google Sign-In for created users only works after their email is registered and linked.

## Verified Endpoints
- `POST /api/v1/auth/login`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `GET /api/v1/users/{id}/branch-access`
- `PATCH /api/v1/users/{id}/branch-access`
- `GET /api/v1/permissions`
- `GET /api/v1/reports/branches/summary`
- `GET /api/v1/audit-logs`
- `PATCH /api/v1/users/{id}/role`

## User-Facing Evidence To Capture
- GeneralDirector login.
- Create academy account panel.
- BranchDirector account creation with selected branches.
- Student or Teacher account creation with academic profile data.
- Temporary password returned once.
- Branch access list showing assigned branches.
- Global branch report.
- Admin-only role update returning `403`.

## Notes
This flow drove a correction: branch access management is now available to GeneralDirector as a business operation. Admin remains responsible for changing existing roles.
