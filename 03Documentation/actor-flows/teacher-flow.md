# Teacher Flow Verification

Status: Passed

Verification source:
- Automated test: `06Code/backend/tests/integration/actor-flows.test.js`
- Command: `npm test`
- Latest observed result: `11 passed, 11 total`, `91 passed, 91 total`

## Actor Goal
A teacher should access their own profile, assigned classes and attendance work, without gaining director or administrative permissions.

## Preconditions
- Teacher account exists in `users`.
- Teacher has a linked `teachers.user_id` profile.
- Class groups and class sessions are assigned to the teacher profile.
- First-login password change is already completed, or the teacher signs in with a linked Google account.

## Main Flow
1. Teacher opens `/login.html`.
2. Teacher signs in with email/password or linked Google Sign-In.
3. System creates a private session.
4. Teacher reads own profile through `GET /api/v1/teachers`.
5. Teacher reads assigned groups through `GET /api/v1/class-groups`.
6. Teacher reads assigned sessions through `GET /api/v1/class-sessions`.
7. Teacher checks in through `POST /api/v1/teacher-attendance/check-in`.
8. Teacher checks out through `PATCH /api/v1/teacher-attendance/{id}/check-out`.
9. Teacher records student attendance for an assigned class through `POST /api/v1/student-attendance`.

Expected result: teacher can complete attendance work only for their own teaching context.

## Alternate Flows
- Teacher tries to check in using another teacher profile and receives `403`.
- Teacher tries a duplicate open check-in and receives `409`.
- Teacher tries to check out the same attendance record twice and receives `409`.
- Teacher tries to access consolidated branch reports and receives `403`.
- Teacher tries to list users or audit logs and receives `403`.
- Teacher cannot use protected academic flows until first password change is completed.

## Verified Endpoints
- `POST /api/v1/auth/google`
- `GET /api/v1/teachers`
- `GET /api/v1/class-groups`
- `GET /api/v1/class-sessions`
- `POST /api/v1/teacher-attendance/check-in`
- `PATCH /api/v1/teacher-attendance/{id}/check-out`
- `POST /api/v1/student-attendance`
- `GET /api/v1/reports/branches/summary`
- `GET /api/v1/users`
- `GET /api/v1/audit-logs`

## User-Facing Evidence To Capture
- Teacher login.
- Teacher check-in success.
- Duplicate check-in rejection.
- Teacher checkout success.
- Student attendance saved by teacher.
- Restricted report or user-list access returning `403`.

## Notes
Teacher read access is scoped through the linked teacher profile and assigned class context. The system blocks administrative operations even when the teacher has a valid session.
