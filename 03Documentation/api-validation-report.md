# API Validation Report

Generated: 2026-07-03T04:48:04.629Z

Scope:
- Local Express application with in-memory repositories.
- Mock Google ID tokens enabled only for automated validation.
- Session cookie, JWT Bearer token, RBAC middleware, validation middleware, CRUD flows, attendance flows, reports and private page guard are exercised through HTTP requests.

Summary:
- Total cases: 102
- Passed: 102
- Failed: 0
- Sample enrollment request id: 9d0f519c-86ef-4ff5-a640-a87fe4a851b8
- Sample attendance record id: fb4fba48-15be-417c-877f-81e1df53c779

| Case | Method | URI | Expected | Actual | Result | Message |
| --- | --- | --- | --- | --- | --- | --- |
| Auth config exposes Google client id | `GET` | `/api/v1/auth/config` | 200 | 200 | Pass | Auth configuration |
| Malformed Google token is rejected | `POST` | `/api/v1/auth/google` | 401 | 401 | Pass | Invalid Google ID token |
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
| Enrollment validation rejects invalid email | `POST` | `/api/v1/enrollment-requests` | 422 | 422 | Pass | Validation failed |
| Public enrollment request is accepted | `POST` | `/api/v1/enrollment-requests` | 201 | 201 | Pass | Enrollment request received |
| Postman password login returns JWT session token | `POST` | `/api/v1/auth/login` | 200 | 200 | Pass | Login successful |
| Postman bearer token can read current session | `GET` | `/api/v1/auth/me` | 200 | 200 | Pass | OK |
| Postman logout revokes bearer token | `POST` | `/api/v1/auth/logout` | 200 | 200 | Pass | Logout successful |
| Postman revoked bearer token is rejected | `GET` | `/api/v1/auth/me` | 401 | 401 | Pass | Authentication required |
| Google login creates session for Student | `POST` | `/api/v1/auth/google` | 200 | 200 | Pass | Login successful |
| Student role cannot access consolidated branch report | `GET` | `/api/v1/reports/branches/summary` | 403 | 403 | Pass | Insufficient permissions |
| Authenticated user can read current session | `GET` | `/api/v1/auth/me` | 200 | 200 | Pass | OK |
| Bearer session token can read current session | `GET` | `/api/v1/auth/me` | 200 | 200 | Pass | OK |
| Logout revokes student session | `POST` | `/api/v1/auth/logout` | 200 | 200 | Pass | Logout successful |
| Revoked session cannot access /auth/me | `GET` | `/api/v1/auth/me` | 401 | 401 | Pass | Authentication required |
| Revoked bearer token cannot access /auth/me | `GET` | `/api/v1/auth/me` | 401 | 401 | Pass | Authentication required |
| Google login creates session for Admin | `POST` | `/api/v1/auth/google` | 200 | 200 | Pass | Login successful |
| Admin lists enrollment requests | `GET` | `/api/v1/enrollment-requests` | 200 | 200 | Pass | Enrollment requests |
| Admin lists users | `GET` | `/api/v1/users` | 200 | 200 | Pass | Users list |
| Admin lists roles | `GET` | `/api/v1/roles` | 200 | 200 | Pass | Roles list |
| Admin lists permissions | `GET` | `/api/v1/permissions` | 200 | 200 | Pass | Permissions list |
| Admin updates a user role | `PATCH` | `/api/v1/users/e84c29c1-9523-400a-b51e-f892a6d35f67/role` | 200 | 200 | Pass | User role updated |
| Admin creates branch | `POST` | `/api/v1/branches` | 201 | 201 | Pass | branches created |
| Admin lists branches | `GET` | `/api/v1/branches` | 200 | 200 | Pass | branches list |
| Admin reads branch by id | `GET` | `/api/v1/branches/1794ece6-1ce6-417b-80e0-c0e322ca1a68` | 200 | 200 | Pass | OK |
| Admin updates branch | `PATCH` | `/api/v1/branches/1794ece6-1ce6-417b-80e0-c0e322ca1a68` | 200 | 200 | Pass | branches updated |
| Admin creates student | `POST` | `/api/v1/students` | 201 | 201 | Pass | students created |
| Admin lists students | `GET` | `/api/v1/students` | 200 | 200 | Pass | students list |
| Admin reads student by id | `GET` | `/api/v1/students/3b1fee06-576a-4b15-96d0-9a8efcb86858` | 200 | 200 | Pass | OK |
| Admin updates student | `PATCH` | `/api/v1/students/3b1fee06-576a-4b15-96d0-9a8efcb86858` | 200 | 200 | Pass | students updated |
| Admin creates teacher | `POST` | `/api/v1/teachers` | 201 | 201 | Pass | teachers created |
| Admin lists teachers | `GET` | `/api/v1/teachers` | 200 | 200 | Pass | teachers list |
| Admin reads teacher by id | `GET` | `/api/v1/teachers/6221a01b-4bcb-4811-854f-fc57bb5351d6` | 200 | 200 | Pass | OK |
| Admin updates teacher | `PATCH` | `/api/v1/teachers/6221a01b-4bcb-4811-854f-fc57bb5351d6` | 200 | 200 | Pass | teachers updated |
| Admin creates dance category | `POST` | `/api/v1/dance-categories` | 201 | 201 | Pass | dance-categories created |
| Admin lists dance categories | `GET` | `/api/v1/dance-categories` | 200 | 200 | Pass | dance-categories list |
| Admin reads dance category by id | `GET` | `/api/v1/dance-categories/b7291562-f4a2-44eb-aaf1-be299c6c9d42` | 200 | 200 | Pass | OK |
| Admin updates dance category | `PATCH` | `/api/v1/dance-categories/b7291562-f4a2-44eb-aaf1-be299c6c9d42` | 200 | 200 | Pass | dance-categories updated |
| Admin creates dance style | `POST` | `/api/v1/dance-styles` | 201 | 201 | Pass | dance-styles created |
| Admin lists dance styles | `GET` | `/api/v1/dance-styles` | 200 | 200 | Pass | dance-styles list |
| Admin reads dance style by id | `GET` | `/api/v1/dance-styles/034ca5b6-460d-4952-85a1-24ddedc487d7` | 200 | 200 | Pass | OK |
| Admin updates dance style | `PATCH` | `/api/v1/dance-styles/034ca5b6-460d-4952-85a1-24ddedc487d7` | 200 | 200 | Pass | dance-styles updated |
| Admin creates class group | `POST` | `/api/v1/class-groups` | 201 | 201 | Pass | class-groups created |
| Admin lists class groups | `GET` | `/api/v1/class-groups` | 200 | 200 | Pass | class-groups list |
| Admin reads class group by id | `GET` | `/api/v1/class-groups/9c3643bb-62c9-4084-819d-0ba5653858a2` | 200 | 200 | Pass | OK |
| Admin updates class group | `PATCH` | `/api/v1/class-groups/9c3643bb-62c9-4084-819d-0ba5653858a2` | 200 | 200 | Pass | class-groups updated |
| Admin creates class session | `POST` | `/api/v1/class-sessions` | 201 | 201 | Pass | class-sessions created |
| Admin creates absence validation class session | `POST` | `/api/v1/class-sessions` | 201 | 201 | Pass | class-sessions created |
| Admin lists class sessions | `GET` | `/api/v1/class-sessions` | 200 | 200 | Pass | class-sessions list |
| Admin reads class session by id | `GET` | `/api/v1/class-sessions/314b9dcf-7d5c-451e-b25f-91392928abd1` | 200 | 200 | Pass | OK |
| Admin updates class session | `PATCH` | `/api/v1/class-sessions/314b9dcf-7d5c-451e-b25f-91392928abd1` | 200 | 200 | Pass | class-sessions updated |
| Admin records student attendance | `POST` | `/api/v1/student-attendance` | 201 | 201 | Pass | Attendance recorded |
| Duplicate student attendance is rejected | `POST` | `/api/v1/student-attendance` | 409 | 409 | Pass | Attendance already recorded for this student and session |
| Admin records absent student attendance | `POST` | `/api/v1/student-attendance` | 201 | 201 | Pass | Attendance recorded |
| Admin checks in teacher | `POST` | `/api/v1/teacher-attendance/check-in` | 201 | 201 | Pass | Teacher checked in |
| Duplicate open teacher check-in is rejected | `POST` | `/api/v1/teacher-attendance/check-in` | 409 | 409 | Pass | Teacher already has an open check-in |
| Admin checks out teacher | `PATCH` | `/api/v1/teacher-attendance/67b6fae3-c074-4e0c-ba2a-37eccc5fb6aa/check-out` | 200 | 200 | Pass | Teacher checked out |
| Duplicate teacher checkout is rejected | `PATCH` | `/api/v1/teacher-attendance/67b6fae3-c074-4e0c-ba2a-37eccc5fb6aa/check-out` | 409 | 409 | Pass | Teacher attendance record already checked out |
| Admin creates absence justification | `POST` | `/api/v1/absence-justifications` | 201 | 201 | Pass | Absence justification created |
| Admin lists absence justifications | `GET` | `/api/v1/absence-justifications` | 200 | 200 | Pass | Absence justifications |
| Admin reviews absence justification | `PATCH` | `/api/v1/absence-justifications/c3dd3fcd-bebf-4a87-8883-4befddd466a9/review` | 200 | 200 | Pass | Absence justification reviewed |
| Admin gets branch summary report | `GET` | `/api/v1/reports/branches/summary` | 200 | 200 | Pass | OK |
| Admin gets scholarship candidate report | `GET` | `/api/v1/reports/scholarships/3b1fee06-576a-4b15-96d0-9a8efcb86858/candidate` | 200 | 200 | Pass | OK |
| Admin gets level promotion candidate report | `GET` | `/api/v1/reports/level-promotions/3b1fee06-576a-4b15-96d0-9a8efcb86858/candidate` | 200 | 200 | Pass | OK |
| Admin gets teacher payment report | `GET` | `/api/v1/reports/teachers/6221a01b-4bcb-4811-854f-fc57bb5351d6/payment` | 200 | 200 | Pass | OK |
| Admin lists scholarship evaluations | `GET` | `/api/v1/scholarship-evaluations` | 200 | 200 | Pass | Scholarship evaluations |
| Admin creates scholarship evaluation | `POST` | `/api/v1/scholarship-evaluations` | 201 | 201 | Pass | Scholarship evaluation registered |
| Admin lists level promotion evaluations | `GET` | `/api/v1/level-promotion-evaluations` | 200 | 200 | Pass | Level promotion evaluations |
| Admin creates level promotion evaluation | `POST` | `/api/v1/level-promotion-evaluations` | 201 | 201 | Pass | Level promotion evaluation registered |
| Admin lists audit logs | `GET` | `/api/v1/audit-logs` | 200 | 200 | Pass | Audit logs |
