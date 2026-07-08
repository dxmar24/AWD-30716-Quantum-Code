# Student Flow Verification

Status: Passed

Verification source:
- Automated test: `06Code/tests/integration/actor-flows.test.js`
- Related auth tests: `06Code/tests/auth/auth.test.js`
- Command: `npm test`
- Latest observed result: `6 passed, 6 total`, `38 passed, 38 total`

## Actor Goal
A student should enter with an academy-owned account, change a temporary password on first sign-in, see only their own academic data and submit allowed self-service requests.

## Preconditions
- The student account exists in `users`.
- The student has a linked `students.user_id` profile.
- New accounts may start with `must_change_password = true`.
- Google Sign-In is optional and only works when the Google email matches the academy account.

## Main Flow
1. Student opens `/login.html`.
2. Student enters the academy email and temporary password.
3. System creates a session and returns `user.mustChangePassword = true`.
4. Private dashboard shows the mandatory password-change screen.
5. Student submits `POST /api/v1/auth/change-password`.
6. System verifies the current password, stores the new password hash, clears `must_change_password` and records `password_changed_at`.
7. Student can enter the academic dashboard.
8. Student can read only their own student profile through `GET /api/v1/students`.
9. Student can read only their own branch through `GET /api/v1/branches`.
10. Student can submit an absence justification for their own attendance record through `POST /api/v1/absence-justifications`.

Expected result: student is admitted only after changing the temporary password and sees only own academic scope.

## Alternate Flows
- Wrong email/password returns `401`.
- Temporary-password session can call `/auth/me`, `/auth/logout` and `/auth/change-password`, but protected academic reads return `403 PASSWORD_CHANGE_REQUIRED`.
- Student tries to justify another student's absence and receives `403`.
- Student tries to record attendance and receives `403`.
- Student tries to open consolidated branch reports and receives `403`.
- Student tries to list users and receives `403`.
- Google Sign-In with an unregistered, unverified or mismatched email is rejected.

## Verified Endpoints
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/change-password`
- `GET /api/v1/students`
- `GET /api/v1/branches`
- `POST /api/v1/absence-justifications`
- `POST /api/v1/student-attendance`
- `GET /api/v1/reports/branches/summary`
- `GET /api/v1/users`

## User-Facing Evidence To Capture
- Login page with email/password.
- Mandatory password-change screen.
- Successful access to the private dashboard after password change.
- Student profile or branch read in Postman showing only one scoped record.
- Rejected restricted action, such as consolidated reports returning `403`.

## Notes
The current browser dashboard verifies the password-change gate. Student-specific deep views are API-verified and can be expanded later into dedicated UI panels.
