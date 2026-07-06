# API Validation Report

Generated: 2026-07-06T11:02:30.549Z

Scope:
- Local Express application with in-memory repositories.
- Mock Google ID tokens enabled only for automated validation.
- Session cookie, JWT Bearer token, RBAC middleware, validation middleware, cache policies, memory-cache evidence, CRUD flows, attendance flows, reports and private page guard are exercised through HTTP requests.

Summary:
- Total cases: 114
- Passed: 114
- Failed: 0
- Sample enrollment request id: 6914aae6-0458-4022-a7d2-9bc35784c61a
- Sample attendance record id: 07436ba6-30ec-480f-9338-214aa51f22ae

| Case | Method | URI | Expected | Actual | Result | Message |
| --- | --- | --- | --- | --- | --- | --- |
| Auth config exposes Google client id and public cache policy | `GET` | `/api/v1/auth/config` | 200 | 200 | Pass | Auth configuration |
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
| Anonymous session response is no-store | `GET` | `/api/v1/auth/me` | 401 | 401 | Pass | Authentication required |
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
| Admin lists roles with private memory cache miss | `GET` | `/api/v1/roles` | 200 | 200 | Pass | Roles list |
| Admin lists roles with memory cache hit | `GET` | `/api/v1/roles` | 200 | 200 | Pass | Roles list |
| Admin lists permissions | `GET` | `/api/v1/permissions` | 200 | 200 | Pass | Permissions list |
| Admin updates a user role | `PATCH` | `/api/v1/users/ae25a087-097a-4b36-9086-0ead8c2ea57a/role` | 200 | 200 | Pass | User role updated |
| Admin creates branch | `POST` | `/api/v1/branches` | 201 | 201 | Pass | branches created |
| Admin lists branches with memory cache miss | `GET` | `/api/v1/branches` | 200 | 200 | Pass | branches list |
| Admin lists branches with memory cache hit | `GET` | `/api/v1/branches` | 200 | 200 | Pass | branches list |
| Admin reads branch by id | `GET` | `/api/v1/branches/fbab011e-d6e2-413b-9481-8ab9da6be77f` | 200 | 200 | Pass | OK |
| Admin updates branch | `PATCH` | `/api/v1/branches/fbab011e-d6e2-413b-9481-8ab9da6be77f` | 200 | 200 | Pass | branches updated |
| Admin branch list cache is invalidated after update | `GET` | `/api/v1/branches` | 200 | 200 | Pass | branches list |
| Google login creates session for BranchDirector | `POST` | `/api/v1/auth/google` | 200 | 200 | Pass | Login successful |
| Admin assigns branch access to BranchDirector | `PATCH` | `/api/v1/users/6b6f2cf1-b84c-4f12-9080-3f14e21285a5/branch-access` | 200 | 200 | Pass | User branch access updated |
| Admin reads BranchDirector branch access | `GET` | `/api/v1/users/6b6f2cf1-b84c-4f12-9080-3f14e21285a5/branch-access` | 200 | 200 | Pass | User branch access |
| BranchDirector sees only assigned branch summary | `GET` | `/api/v1/reports/branches/summary` | 200 | 200 | Pass | OK |
| BranchDirector branch summary uses scoped memory cache hit | `GET` | `/api/v1/reports/branches/summary` | 200 | 200 | Pass | OK |
| BranchDirector creates student in assigned branch | `POST` | `/api/v1/students` | 201 | 201 | Pass | students created |
| BranchDirector cannot create student in unassigned branch | `POST` | `/api/v1/students` | 403 | 403 | Pass | Insufficient permissions |
| Admin creates student | `POST` | `/api/v1/students` | 201 | 201 | Pass | students created |
| Admin lists students | `GET` | `/api/v1/students` | 200 | 200 | Pass | students list |
| Admin reads student by id | `GET` | `/api/v1/students/40ced10b-d37c-4f1b-ad53-493f80891d44` | 200 | 200 | Pass | OK |
| Admin updates student | `PATCH` | `/api/v1/students/40ced10b-d37c-4f1b-ad53-493f80891d44` | 200 | 200 | Pass | students updated |
| Admin creates teacher | `POST` | `/api/v1/teachers` | 201 | 201 | Pass | teachers created |
| Admin lists teachers | `GET` | `/api/v1/teachers` | 200 | 200 | Pass | teachers list |
| Admin reads teacher by id | `GET` | `/api/v1/teachers/a854377c-8e89-4a66-b7c5-6d74c5c08665` | 200 | 200 | Pass | OK |
| Admin updates teacher | `PATCH` | `/api/v1/teachers/a854377c-8e89-4a66-b7c5-6d74c5c08665` | 200 | 200 | Pass | teachers updated |
| Admin creates dance category | `POST` | `/api/v1/dance-categories` | 201 | 201 | Pass | dance-categories created |
| Admin lists dance categories | `GET` | `/api/v1/dance-categories` | 200 | 200 | Pass | dance-categories list |
| Admin reads dance category by id | `GET` | `/api/v1/dance-categories/56762879-5ddd-444d-8498-0302c461879c` | 200 | 200 | Pass | OK |
| Admin updates dance category | `PATCH` | `/api/v1/dance-categories/56762879-5ddd-444d-8498-0302c461879c` | 200 | 200 | Pass | dance-categories updated |
| Admin creates dance style | `POST` | `/api/v1/dance-styles` | 201 | 201 | Pass | dance-styles created |
| Admin lists dance styles | `GET` | `/api/v1/dance-styles` | 200 | 200 | Pass | dance-styles list |
| Admin reads dance style by id | `GET` | `/api/v1/dance-styles/f870e85c-cfd3-41c9-81de-a15b424b55a3` | 200 | 200 | Pass | OK |
| Admin updates dance style | `PATCH` | `/api/v1/dance-styles/f870e85c-cfd3-41c9-81de-a15b424b55a3` | 200 | 200 | Pass | dance-styles updated |
| Admin creates class group | `POST` | `/api/v1/class-groups` | 201 | 201 | Pass | class-groups created |
| Admin lists class groups | `GET` | `/api/v1/class-groups` | 200 | 200 | Pass | class-groups list |
| Admin reads class group by id | `GET` | `/api/v1/class-groups/15c96ffa-9258-44ca-a73d-4f2059fa6eb8` | 200 | 200 | Pass | OK |
| Admin updates class group | `PATCH` | `/api/v1/class-groups/15c96ffa-9258-44ca-a73d-4f2059fa6eb8` | 200 | 200 | Pass | class-groups updated |
| Admin creates class session | `POST` | `/api/v1/class-sessions` | 201 | 201 | Pass | class-sessions created |
| Admin creates absence validation class session | `POST` | `/api/v1/class-sessions` | 201 | 201 | Pass | class-sessions created |
| Admin lists class sessions | `GET` | `/api/v1/class-sessions` | 200 | 200 | Pass | class-sessions list |
| Admin reads class session by id | `GET` | `/api/v1/class-sessions/7df1e549-b31d-44c3-8ef5-f3abf285b7d9` | 200 | 200 | Pass | OK |
| Admin updates class session | `PATCH` | `/api/v1/class-sessions/7df1e549-b31d-44c3-8ef5-f3abf285b7d9` | 200 | 200 | Pass | class-sessions updated |
| Admin records student attendance | `POST` | `/api/v1/student-attendance` | 201 | 201 | Pass | Attendance recorded |
| Duplicate student attendance is rejected | `POST` | `/api/v1/student-attendance` | 409 | 409 | Pass | Attendance already recorded for this student and session |
| Admin records absent student attendance | `POST` | `/api/v1/student-attendance` | 201 | 201 | Pass | Attendance recorded |
| Admin checks in teacher | `POST` | `/api/v1/teacher-attendance/check-in` | 201 | 201 | Pass | Teacher checked in |
| Duplicate open teacher check-in is rejected | `POST` | `/api/v1/teacher-attendance/check-in` | 409 | 409 | Pass | Teacher already has an open check-in |
| Admin checks out teacher | `PATCH` | `/api/v1/teacher-attendance/1033abbb-507a-4949-963e-6665f7c5ec98/check-out` | 200 | 200 | Pass | Teacher checked out |
| Duplicate teacher checkout is rejected | `PATCH` | `/api/v1/teacher-attendance/1033abbb-507a-4949-963e-6665f7c5ec98/check-out` | 409 | 409 | Pass | Teacher attendance record already checked out |
| Admin creates absence justification | `POST` | `/api/v1/absence-justifications` | 201 | 201 | Pass | Absence justification created |
| Admin lists absence justifications | `GET` | `/api/v1/absence-justifications` | 200 | 200 | Pass | Absence justifications |
| Admin reviews absence justification | `PATCH` | `/api/v1/absence-justifications/3f1cdbb2-68b7-4359-b3b1-e2b4a6eced84/review` | 200 | 200 | Pass | Absence justification reviewed |
| Admin gets branch summary report with memory cache miss | `GET` | `/api/v1/reports/branches/summary` | 200 | 200 | Pass | OK |
| Admin gets branch summary report with memory cache hit | `GET` | `/api/v1/reports/branches/summary` | 200 | 200 | Pass | OK |
| Admin gets scholarship candidate report | `GET` | `/api/v1/reports/scholarships/40ced10b-d37c-4f1b-ad53-493f80891d44/candidate` | 200 | 200 | Pass | OK |
| Admin gets level promotion candidate report | `GET` | `/api/v1/reports/level-promotions/40ced10b-d37c-4f1b-ad53-493f80891d44/candidate` | 200 | 200 | Pass | OK |
| Admin gets teacher payment report | `GET` | `/api/v1/reports/teachers/a854377c-8e89-4a66-b7c5-6d74c5c08665/payment` | 200 | 200 | Pass | OK |
| Admin lists scholarship evaluations | `GET` | `/api/v1/scholarship-evaluations` | 200 | 200 | Pass | Scholarship evaluations |
| Admin creates scholarship evaluation | `POST` | `/api/v1/scholarship-evaluations` | 201 | 201 | Pass | Scholarship evaluation registered |
| Admin lists level promotion evaluations | `GET` | `/api/v1/level-promotion-evaluations` | 200 | 200 | Pass | Level promotion evaluations |
| Admin creates level promotion evaluation | `POST` | `/api/v1/level-promotion-evaluations` | 201 | 201 | Pass | Level promotion evaluation registered |
| Admin lists audit logs | `GET` | `/api/v1/audit-logs` | 200 | 200 | Pass | Audit logs |
