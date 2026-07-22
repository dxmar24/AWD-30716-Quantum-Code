# API Validation Report

Generated: 2026-07-22T16:03:33.786Z

Scope:
- Local Express application with in-memory repositories.
- Mock Google ID tokens enabled only for automated validation.
- Session cookie, JWT Bearer token, RBAC middleware, validation middleware, cache policies, memory-cache evidence, CRUD flows, attendance flows, reports and private page guard are exercised through HTTP requests.

Summary:
- Total cases: 134
- Passed: 134
- Failed: 0
- Sample enrollment request id: a49bbc3a-cf29-4a4f-99e0-e542c701f1bf
- Sample attendance record id: c796985d-dd52-4388-b73b-05dd151b11c9

| Case | Method | URI | Expected | Actual | Result | Message |
| --- | --- | --- | --- | --- | --- | --- |
| Auth config exposes Google client id and public cache policy | `GET` | `/api/v1/auth/config` | 200 | 200 | Pass | Auth configuration |
| Public branch catalog exposes active branches | `GET` | `/api/v1/public/branches` | 200 | 200 | Pass | Public branches list |
| Malformed Google token is rejected | `POST` | `/api/v1/auth/google` | 401 | 401 | Pass | Invalid Google ID token |
| Unregistered Google email is rejected | `POST` | `/api/v1/auth/google` | 401 | 401 | Pass | Google account is not registered in the academy |
| Unverified Google email is rejected | `POST` | `/api/v1/auth/google` | 401 | 401 | Pass | Google email is not verified |
| Linked Google account with different email is rejected | `POST` | `/api/v1/auth/google` | 409 | 409 | Pass | Google email does not match the academy account |
| Postman password login rejects invalid credentials | `POST` | `/api/v1/auth/login` | 401 | 401 | Pass | Invalid email or password |
| Logout without an active session is harmless | `POST` | `/api/v1/auth/logout` | 200 | 200 | Pass | Logout successful |
| Private dashboard redirects anonymous users to login | `GET` | `/private/dashboard.html` | 302 | 302 | Pass | /login.html?session=expired |
| Login page is served publicly | `GET` | `/login.html` | 200 | 200 | Pass | OK |
| Anonymous request blocked: GET /api/v1/auth/me | `GET` | `/api/v1/auth/me` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/enrollment-requests | `GET` | `/api/v1/enrollment-requests` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/users | `GET` | `/api/v1/users` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: PATCH /api/v1/users/d8c025f6-bcd0-4f25-a6b1-1486338678e7/role | `PATCH` | `/api/v1/users/d8c025f6-bcd0-4f25-a6b1-1486338678e7/role` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/roles | `GET` | `/api/v1/roles` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/permissions | `GET` | `/api/v1/permissions` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/branches | `GET` | `/api/v1/branches` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/branches/0c8675f1-9c30-430a-8b2c-c4dd1ec88b09 | `GET` | `/api/v1/branches/0c8675f1-9c30-430a-8b2c-c4dd1ec88b09` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: POST /api/v1/branches | `POST` | `/api/v1/branches` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/students | `GET` | `/api/v1/students` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: POST /api/v1/students | `POST` | `/api/v1/students` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/teachers | `GET` | `/api/v1/teachers` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: POST /api/v1/teachers | `POST` | `/api/v1/teachers` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/dance-categories | `GET` | `/api/v1/dance-categories` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: POST /api/v1/dance-categories | `POST` | `/api/v1/dance-categories` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/dance-styles | `GET` | `/api/v1/dance-styles` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/class-groups | `GET` | `/api/v1/class-groups` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/class-sessions | `GET` | `/api/v1/class-sessions` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: POST /api/v1/student-attendance | `POST` | `/api/v1/student-attendance` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: POST /api/v1/teacher-attendance/check-in | `POST` | `/api/v1/teacher-attendance/check-in` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: PATCH /api/v1/teacher-attendance/01c99342-ad47-4c4e-a094-6cab138d98e5/check-out | `PATCH` | `/api/v1/teacher-attendance/01c99342-ad47-4c4e-a094-6cab138d98e5/check-out` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/absence-justifications | `GET` | `/api/v1/absence-justifications` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/reports/branches/summary | `GET` | `/api/v1/reports/branches/summary` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/reports/scholarships/85f4bbe9-5d5f-4126-89b6-ddd9de432885/candidate | `GET` | `/api/v1/reports/scholarships/85f4bbe9-5d5f-4126-89b6-ddd9de432885/candidate` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/reports/level-promotions/85f4bbe9-5d5f-4126-89b6-ddd9de432885/candidate | `GET` | `/api/v1/reports/level-promotions/85f4bbe9-5d5f-4126-89b6-ddd9de432885/candidate` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/reports/teachers/01c99342-ad47-4c4e-a094-6cab138d98e5/payment | `GET` | `/api/v1/reports/teachers/01c99342-ad47-4c4e-a094-6cab138d98e5/payment` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/scholarship-evaluations | `GET` | `/api/v1/scholarship-evaluations` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/level-promotion-evaluations | `GET` | `/api/v1/level-promotion-evaluations` | 401 | 401 | Pass | Authentication required |
| Anonymous request blocked: GET /api/v1/audit-logs | `GET` | `/api/v1/audit-logs` | 401 | 401 | Pass | Authentication required |
| Anonymous session response is no-store | `GET` | `/api/v1/auth/me` | 401 | 401 | Pass | Authentication required |
| Enrollment validation rejects invalid email | `POST` | `/api/v1/enrollment-requests` | 422 | 422 | Pass | Validation failed |
| Public enrollment request is accepted | `POST` | `/api/v1/enrollment-requests` | 201 | 201 | Pass | Enrollment request received |
| Postman password login returns JWT session token | `POST` | `/api/v1/auth/login` | 200 | 200 | Pass | Login successful |
| Postman bearer token can read current session | `GET` | `/api/v1/auth/me` | 200 | 200 | Pass | OK |
| Postman logout revokes bearer token | `POST` | `/api/v1/auth/logout` | 200 | 200 | Pass | Logout successful |
| Postman revoked bearer token is rejected | `GET` | `/api/v1/auth/me` | 401 | 401 | Pass | Authentication required |
| Google login opens existing session for Student | `POST` | `/api/v1/auth/google` | 200 | 200 | Pass | Login successful |
| Student role cannot access consolidated branch report | `GET` | `/api/v1/reports/branches/summary` | 403 | 403 | Pass | Insufficient permissions |
| Authenticated user can read current session | `GET` | `/api/v1/auth/me` | 200 | 200 | Pass | OK |
| Bearer session token can read current session | `GET` | `/api/v1/auth/me` | 200 | 200 | Pass | OK |
| Logout revokes student session | `POST` | `/api/v1/auth/logout` | 200 | 200 | Pass | Logout successful |
| Revoked session cannot access /auth/me | `GET` | `/api/v1/auth/me` | 401 | 401 | Pass | Authentication required |
| Revoked bearer token cannot access /auth/me | `GET` | `/api/v1/auth/me` | 401 | 401 | Pass | Authentication required |
| Google login opens existing session for Admin | `POST` | `/api/v1/auth/google` | 200 | 200 | Pass | Login successful |
| Admin lists enrollment requests | `GET` | `/api/v1/enrollment-requests` | 200 | 200 | Pass | Enrollment requests |
| Admin lists users | `GET` | `/api/v1/users` | 200 | 200 | Pass | Users list |
| Admin creates academy account and sends the temporary password by email | `POST` | `/api/v1/users` | 201 | 201 | Pass | User created |
| Temporary password login requires first password change | `POST` | `/api/v1/auth/login` | 200 | 200 | Pass | Login successful |
| Temporary-password session is blocked from academic catalogs | `GET` | `/api/v1/roles` | 403 | 403 | Pass | Password change required |
| Temporary-password user changes password | `POST` | `/api/v1/auth/change-password` | 200 | 200 | Pass | Password changed |
| Password-changed session can read academic branch catalog | `GET` | `/api/v1/branches` | 200 | 200 | Pass | branches list |
| Admin lists roles with private memory cache miss | `GET` | `/api/v1/roles` | 200 | 200 | Pass | Roles list |
| Admin lists roles with memory cache hit | `GET` | `/api/v1/roles` | 200 | 200 | Pass | Roles list |
| Admin lists permissions | `GET` | `/api/v1/permissions` | 200 | 200 | Pass | Permissions list |
| Admin updates a user role | `PATCH` | `/api/v1/users/87ca0e14-e160-4e26-9b11-1e64b050ad39/role` | 200 | 200 | Pass | User role updated |
| Admin creates branch | `POST` | `/api/v1/branches` | 201 | 201 | Pass | branches created |
| Admin lists branches with memory cache miss | `GET` | `/api/v1/branches` | 200 | 200 | Pass | branches list |
| Admin lists branches with memory cache hit | `GET` | `/api/v1/branches` | 200 | 200 | Pass | branches list |
| Admin reads branch by id | `GET` | `/api/v1/branches/eeaf1b0b-ec7d-422f-95fe-5544fbe65fc9` | 200 | 200 | Pass | OK |
| Admin updates branch | `PATCH` | `/api/v1/branches/eeaf1b0b-ec7d-422f-95fe-5544fbe65fc9` | 200 | 200 | Pass | branches updated |
| Admin branch list cache is invalidated after update | `GET` | `/api/v1/branches` | 200 | 200 | Pass | branches list |
| Google login opens existing session for BranchDirector | `POST` | `/api/v1/auth/google` | 200 | 200 | Pass | Login successful |
| Admin assigns branch access to BranchDirector | `PATCH` | `/api/v1/users/9e868e7f-16b3-4958-901c-949d28d6e248/branch-access` | 200 | 200 | Pass | User branch access updated |
| Admin reads BranchDirector branch access | `GET` | `/api/v1/users/9e868e7f-16b3-4958-901c-949d28d6e248/branch-access` | 200 | 200 | Pass | User branch access |
| BranchDirector sees only assigned branch summary | `GET` | `/api/v1/reports/branches/summary` | 200 | 200 | Pass | OK |
| BranchDirector branch summary uses scoped memory cache hit | `GET` | `/api/v1/reports/branches/summary` | 200 | 200 | Pass | OK |
| BranchDirector creates student in assigned branch | `POST` | `/api/v1/students` | 201 | 201 | Pass | students created |
| BranchDirector cannot create student in unassigned branch | `POST` | `/api/v1/students` | 403 | 403 | Pass | Insufficient permissions |
| Admin creates student | `POST` | `/api/v1/students` | 201 | 201 | Pass | students created |
| Admin lists students | `GET` | `/api/v1/students` | 200 | 200 | Pass | students list |
| Admin reads student by id | `GET` | `/api/v1/students/24a4146e-bd98-40f1-b4bd-f27f6b67c93a` | 200 | 200 | Pass | OK |
| Admin updates student | `PATCH` | `/api/v1/students/24a4146e-bd98-40f1-b4bd-f27f6b67c93a` | 200 | 200 | Pass | students updated |
| Admin creates teacher | `POST` | `/api/v1/teachers` | 201 | 201 | Pass | teachers created |
| Admin lists teachers | `GET` | `/api/v1/teachers` | 200 | 200 | Pass | teachers list |
| Admin reads teacher by id | `GET` | `/api/v1/teachers/47d9929b-894b-478a-90c1-e5be3916a27a` | 200 | 200 | Pass | OK |
| Admin updates teacher | `PATCH` | `/api/v1/teachers/47d9929b-894b-478a-90c1-e5be3916a27a` | 200 | 200 | Pass | teachers updated |
| Admin creates dance category | `POST` | `/api/v1/dance-categories` | 201 | 201 | Pass | dance-categories created |
| Admin lists dance categories | `GET` | `/api/v1/dance-categories` | 200 | 200 | Pass | dance-categories list |
| Admin reads dance category by id | `GET` | `/api/v1/dance-categories/a20eb063-387f-441b-89d1-62c3234b0761` | 200 | 200 | Pass | OK |
| Admin updates dance category | `PATCH` | `/api/v1/dance-categories/a20eb063-387f-441b-89d1-62c3234b0761` | 200 | 200 | Pass | dance-categories updated |
| Admin creates dance style | `POST` | `/api/v1/dance-styles` | 201 | 201 | Pass | dance-styles created |
| Admin lists dance styles | `GET` | `/api/v1/dance-styles` | 200 | 200 | Pass | dance-styles list |
| Admin reads dance style by id | `GET` | `/api/v1/dance-styles/1a5e2f2d-6921-4a2f-b7fe-c05296a2fa36` | 200 | 200 | Pass | OK |
| Admin updates dance style | `PATCH` | `/api/v1/dance-styles/1a5e2f2d-6921-4a2f-b7fe-c05296a2fa36` | 200 | 200 | Pass | dance-styles updated |
| Admin creates class group | `POST` | `/api/v1/class-groups` | 201 | 201 | Pass | class-groups created |
| Admin lists class groups | `GET` | `/api/v1/class-groups` | 200 | 200 | Pass | class-groups list |
| Admin reads class group by id | `GET` | `/api/v1/class-groups/c6966274-28de-481b-93a8-1111de8f41f3` | 200 | 200 | Pass | OK |
| Admin updates class group | `PATCH` | `/api/v1/class-groups/c6966274-28de-481b-93a8-1111de8f41f3` | 200 | 200 | Pass | class-groups updated |
| Admin enrolls student in class group | `POST` | `/api/v1/class-group-enrollments` | 201 | 201 | Pass | Class group enrollment created |
| Admin lists class group enrollments | `GET` | `/api/v1/class-group-enrollments` | 200 | 200 | Pass | Class group enrollments |
| Admin creates class session | `POST` | `/api/v1/class-sessions` | 201 | 201 | Pass | class-sessions created |
| Admin creates absence validation class session | `POST` | `/api/v1/class-sessions` | 201 | 201 | Pass | class-sessions created |
| Admin lists class sessions | `GET` | `/api/v1/class-sessions` | 200 | 200 | Pass | class-sessions list |
| Admin reads class session by id | `GET` | `/api/v1/class-sessions/b87a5435-e3cb-4778-8b5c-1d67ce0af620` | 200 | 200 | Pass | OK |
| Admin updates class session | `PATCH` | `/api/v1/class-sessions/b87a5435-e3cb-4778-8b5c-1d67ce0af620` | 200 | 200 | Pass | class-sessions updated |
| Admin records student attendance | `POST` | `/api/v1/student-attendance` | 201 | 201 | Pass | Attendance recorded |
| Duplicate student attendance is rejected | `POST` | `/api/v1/student-attendance` | 409 | 409 | Pass | Attendance already recorded for this student and session |
| Admin records absent student attendance | `POST` | `/api/v1/student-attendance` | 201 | 201 | Pass | Attendance recorded |
| Admin checks in teacher | `POST` | `/api/v1/teacher-attendance/check-in` | 201 | 201 | Pass | Teacher checked in |
| Duplicate open teacher check-in is rejected | `POST` | `/api/v1/teacher-attendance/check-in` | 409 | 409 | Pass | Teacher already has an open check-in |
| Admin checks out teacher | `PATCH` | `/api/v1/teacher-attendance/211fb106-2af6-43d4-87d7-eba93fa2bdb7/check-out` | 200 | 200 | Pass | Teacher checked out |
| Duplicate teacher checkout is rejected | `PATCH` | `/api/v1/teacher-attendance/211fb106-2af6-43d4-87d7-eba93fa2bdb7/check-out` | 409 | 409 | Pass | Teacher attendance record already checked out |
| Admin creates absence justification | `POST` | `/api/v1/absence-justifications` | 201 | 201 | Pass | Absence justification created |
| Admin lists absence justifications | `GET` | `/api/v1/absence-justifications` | 200 | 200 | Pass | Absence justifications |
| Admin reviews absence justification | `PATCH` | `/api/v1/absence-justifications/abf3731e-cdb3-42b4-ad92-a88ca4cb5aed/review` | 200 | 200 | Pass | Absence justification reviewed |
| Admin gets branch summary report with memory cache miss | `GET` | `/api/v1/reports/branches/summary` | 200 | 200 | Pass | OK |
| Admin gets branch summary report with memory cache hit | `GET` | `/api/v1/reports/branches/summary` | 200 | 200 | Pass | OK |
| Admin gets scholarship candidate report | `GET` | `/api/v1/reports/scholarships/24a4146e-bd98-40f1-b4bd-f27f6b67c93a/candidate` | 200 | 200 | Pass | OK |
| Admin gets level promotion candidate report | `GET` | `/api/v1/reports/level-promotions/24a4146e-bd98-40f1-b4bd-f27f6b67c93a/candidate` | 200 | 200 | Pass | OK |
| Admin gets teacher payment report | `GET` | `/api/v1/reports/teachers/47d9929b-894b-478a-90c1-e5be3916a27a/payment` | 200 | 200 | Pass | OK |
| Admin gets filtered general report | `GET` | `/api/v1/reports/general?from=2026-01-01T00%3A00%3A00.000Z&to=2026-12-31T23%3A59%3A59.999Z&level=B1` | 200 | 200 | Pass | OK |
| Admin gets detailed attendance report | `GET` | `/api/v1/reports/attendance?from=2026-01-01T00%3A00%3A00.000Z&to=2026-12-31T23%3A59%3A59.999Z&level=B1` | 200 | 200 | Pass | OK |
| Attendance report rejects unsupported level filter | `GET` | `/api/v1/reports/attendance?level=B3` | 422 | 422 | Pass | Invalid level |
| Admin lists scholarship evaluations | `GET` | `/api/v1/scholarship-evaluations` | 200 | 200 | Pass | Scholarship evaluations |
| Admin creates scholarship evaluation | `POST` | `/api/v1/scholarship-evaluations` | 201 | 201 | Pass | Scholarship evaluation registered |
| Admin lists level promotion evaluations | `GET` | `/api/v1/level-promotion-evaluations` | 200 | 200 | Pass | Level promotion evaluations |
| Admin creates level promotion evaluation | `POST` | `/api/v1/level-promotion-evaluations` | 201 | 201 | Pass | Level promotion evaluation registered |
| Admin resets another user password | `POST` | `/api/v1/users/e8bacf57-2c8c-4d10-a587-c5727a089d30/reset-password` | 200 | 200 | Pass | Access email sent |
| Password reset revokes previous bearer session | `GET` | `/api/v1/branches` | 401 | 401 | Pass | Authentication required |
| Admin deactivates another user account | `PATCH` | `/api/v1/users/e8bacf57-2c8c-4d10-a587-c5727a089d30/status` | 200 | 200 | Pass | User status updated |
| Deactivated user cannot sign in with temporary password | `POST` | `/api/v1/auth/login` | 401 | 401 | Pass | Invalid email or password |
| Admin reactivates role-ready user account | `PATCH` | `/api/v1/users/e8bacf57-2c8c-4d10-a587-c5727a089d30/status` | 200 | 200 | Pass | User status updated |
| Reactivated user signs in and must change temporary password | `POST` | `/api/v1/auth/login` | 200 | 200 | Pass | Login successful |
| Admin lists audit logs | `GET` | `/api/v1/audit-logs` | 200 | 200 | Pass | Audit logs |
