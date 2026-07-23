# Student Flow Verification

Status: Passed

Verification source:
- Automated test: `06Code/backend/tests/integration/actor-flows.test.js`
- Related auth tests: `06Code/backend/tests/auth/auth.test.js`
- Command: `npm test`
- Latest observed result: `11 passed, 11 total`, `94 passed, 94 total`

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
11. The student may attach a JPEG, PNG, WebP or PDF file up to 5 MB instead of publishing an external link.
12. The attachment remains private in PostgreSQL and can be read only through the authenticated evidence endpoint.
13. When the student returns to the public landing page with an active session, the header shows the student name and profile photo; selecting it returns to the private panel.

Expected result: student is admitted only after changing the temporary password and sees only own academic scope.

## Alternate Flows
- Wrong email/password returns `401`.
- Temporary-password session can call `/auth/me`, `/auth/logout` and `/auth/change-password`, but protected academic reads return `403 PASSWORD_CHANGE_REQUIRED`.
- Student tries to justify another student's absence and receives `403`.
- A renamed or forged attachment whose bytes do not match its declared format receives `422 INVALID_EVIDENCE_FILE`.
- An attachment larger than 5 MB receives `413 EVIDENCE_FILE_TOO_LARGE`.
- Another student tries to read the private attachment and receives `403`.
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
- `GET /api/v1/absence-justifications/{id}/evidence`
- `POST /api/v1/student-attendance`
- `GET /api/v1/reports/branches/summary`
- `GET /api/v1/users`

## User-Facing Evidence To Capture
- Login page with email/password.
- Mandatory password-change screen.
- Successful access to the private dashboard after password change.
- Student profile or branch read in Postman showing only one scoped record.
- Justification form showing the image/PDF selector and a successful private attachment upload.
- Director view opening the attachment through the protected evidence route.
- Rejected restricted action, such as consolidated reports returning `403`.

## Notes
The browser dashboard includes dedicated student attendance, justification, payment, event and profile-photo views. The evidence upload is covered by an integration test that verifies valid PDF bytes, safe response metadata, ownership enforcement and forged-content rejection.
