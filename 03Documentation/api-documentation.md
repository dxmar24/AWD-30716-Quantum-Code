# REST API Documentation

Node API base URI: `/api/v1`

Python Analytics API base URI: `/api/analytics/v1`

Common headers:
- `Content-Type: application/json`
- Authenticated endpoints require cookie `alc_session` or `Authorization: Bearer <session-token>`.
- Cache policy evidence is exposed with `X-Cache-Policy`.
- Server memory-cache evidence is exposed with `X-Memory-Cache`, `X-Memory-Cache-Key` and `X-Memory-Cache-TTL` when an endpoint uses the application cache.

Response envelope:
```json
{ "success": true, "message": "OK", "data": {} }
```
```json
{ "success": false, "message": "Validation failed", "details": {} }
```

Common status codes: `200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`, `500`.

## Cache Behavior

| Endpoint or asset | Cache behavior |
| --- | --- |
| `GET /auth/config` | Public HTTP cache for 3600 seconds; safe because it only exposes OAuth client metadata. |
| Sensitive `/api/v1/*` responses | `Cache-Control: no-store, no-cache, must-revalidate, private`. |
| `GET /roles`, `GET /permissions` | Private HTTP cache plus in-memory cache for repeated catalog reads. |
| `GET /branches`, `GET /dance-categories`, `GET /dance-styles` | Private HTTP cache plus actor-scoped in-memory cache; writes invalidate related tags. |
| `GET /reports/branches/summary` | Private actor-scoped in-memory cache with short TTL; branch/student/attendance/evaluation writes invalidate report tags. |
| `/assets/*` | Public immutable cache for built frontend assets. |
| HTML pages and login page | Revalidate on every navigation. |
| `GET /api/analytics/v1/health` | Public short cache for 60 seconds. |
| Protected Python analytics endpoints | No-store. |

Detailed cache evidence is documented in `03Documentation/cache-management.md`.

## Endpoint Reference
| Method | URI | Description | Required Role | Params/Query | Body | Success | Business/Validation | Errors |
|---|---|---|---|---|---|---|---|---|
| GET | `/auth/config` | Public auth client configuration for the React login page. | Visitor | None | None | `200` Google client id | Does not expose secrets; client id is public OAuth metadata. Uses `Cache-Control: public, max-age=3600`. | `500` |
| POST | `/auth/login` | Email/password login for existing academy users. | Visitor | None | `{ "email": "admin@alc.edu", "password": "secret" }` | `200` user, JWT `sessionToken`, Bearer token type and HttpOnly cookie | Uses `users.password_hash`. The response includes `user.mustChangePassword`; temporary-password users must change password before protected academic flows. Legacy configured Postman credential remains supported only when enabled. Rate limited. | `401`, `422` |
| POST | `/auth/google` | Google login for existing academy users. | Visitor | None | `{ "idToken": "jwt" }` | `200` user, JWT `sessionToken`, Bearer token type and HttpOnly cookie | Token must be valid in production. Google never creates new users; it links only to an active internal account with the same verified email. Unverified Google emails, inactive accounts and linked email mismatches are rejected. | `401`, `409`, `422` |
| GET | `/auth/me` | Current session user. | Authenticated | None | None | `200` user | Session must exist, not revoked and not expired. | `401` |
| POST | `/auth/change-password` | Change the signed-in user's password. | Authenticated | None | `{ "currentPassword": "temporary", "newPassword": "newSecret123" }` | `200` user | Required when `mustChangePassword=true`; clears the flag and stores `password_changed_at`. | `401`, `422` |
| POST | `/auth/logout` | Revoke session and clear cookie. | Any | None | None | `200` | Revokes server session/token hash. | `200` even without active session |
| POST | `/enrollment-requests` | Public enrollment request. | Visitor | None | fullName, email, optional phone/preferredBranch/styleInterest/message | `201` request | Email format and name length validated. | `422` |
| GET | `/enrollment-requests` | List public requests. | BranchDirector, GeneralDirector, Admin | None | None | `200` list | Restricted to directors/admin. | `401`, `403` |
| GET | `/users` | List users. | GeneralDirector, Admin | None | None | `200` list | Internal roles only. | `401`, `403` |
| POST | `/users` | Create an academy user with a temporary password. | GeneralDirector, Admin | None | email, name, role, optional temporaryPassword, active, mustChangePassword, branchIds | `201` user plus one-time temporary password | Stores only a password hash. New users default to `mustChangePassword=true`. Optional branch IDs are validated before user creation and then assigned. BranchDirector accounts require at least one branch ID. Audited. | `401`, `403`, `404`, `409`, `422` |
| PATCH | `/users/{id}/role` | Assign internal role. | Admin | Path `id` | `{ "role": "Teacher" }` | `200` user | Role must be Student, Teacher, BranchDirector, GeneralDirector or Admin. Audited. | `401`, `403`, `404`, `422` |
| GET | `/users/{id}/branch-access` | List branch access assigned to a user. | GeneralDirector, Admin | Path `id` | None | `200` list | Used to scope BranchDirector permissions to specific branches. | `401`, `403`, `404` |
| PATCH | `/users/{id}/branch-access` | Replace branch access assigned to a user. | GeneralDirector, Admin | Path `id` | `{ "branchIds": ["uuid"] }` | `200` list | Branch IDs must exist. Audited. | `401`, `403`, `404`, `422` |
| GET | `/roles` | List roles. | Authenticated | None | None | `200` list | Roles seeded by app. Private HTTP cache and memory-cache `MISS/HIT` headers. | `401` |
| GET | `/permissions` | List permissions. | GeneralDirector, Admin | None | None | `200` list | Permission catalog seeded. Private HTTP cache and memory-cache `MISS/HIT` headers. | `401`, `403` |
| GET | `/branches` | List branches. | Authenticated | None | None | `200` list | Five academy branches seeded. Actor-scoped memory cache; branch writes invalidate the list. | `401` |
| POST | `/branches` | Create branch. | GeneralDirector, Admin | None | name, city, active | `201` branch | Validates name length. BranchDirector cannot create global branch records. | `401`, `403`, `422` |
| PATCH | `/branches/{id}` | Update branch. | GeneralDirector, Admin | Path `id` | partial branch | `200` branch | Auditable global academic data change. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/students` | List/create/update students. | Read: scoped authenticated. Write: scoped directors/admin | Path `id` on item routes | userId, branchId, fullName, level, active | `200`/`201` | BranchDirector is limited to assigned branches; Student sees only own profile. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/teachers` | List/create/update teachers. | Read: scoped authenticated. Write: scoped directors/admin | Path `id` | userId, branchId, fullName, hourlyRate, active | `200`/`201` | BranchDirector is limited to assigned branches; Teacher sees only own profile. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/dance-categories` | Manage dance categories. | Read: authenticated. Write: GeneralDirector/Admin | Path `id` | name | `200`/`201` | Global catalog data is not branch-scoped. Read lists use private memory cache; writes invalidate catalog cache. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/dance-styles` | Manage dance styles. | Read: authenticated. Write: GeneralDirector/Admin | Path `id` | categoryId, name | `200`/`201` | Global catalog data is not branch-scoped. Read lists use private memory cache; writes invalidate catalog cache. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/class-groups` | Manage class groups. | Read: scoped authenticated. Write: scoped directors/admin | Path `id` | branchId, styleId, teacherId, name, level, active | `200`/`201` | BranchDirector is limited to assigned branches; Teacher sees own groups. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/class-sessions` | Manage scheduled sessions. | Read: scoped authenticated. Write: scoped directors/admin | Path `id` | classGroupId, startsAt, endsAt, status | `200`/`201` | Access is inherited from the class group branch/teacher. | `401`, `403`, `404`, `422` |
| POST | `/student-attendance` | Record student attendance. | Teacher, BranchDirector, GeneralDirector, Admin | None | studentId, classSessionId, status, notes | `201` record | One record per student/session. Status: present, absent, justified, late. Audited. | `401`, `403`, `404`, `409`, `422` |
| POST | `/teacher-attendance/check-in` | Teacher check-in. | Teacher, BranchDirector, GeneralDirector, Admin | None | teacherId, optional classSessionId | `201` record | One open check-in per teacher. Audited. | `401`, `403`, `404`, `409`, `422` |
| PATCH | `/teacher-attendance/{id}/check-out` | Teacher check-out. | Teacher, BranchDirector, GeneralDirector, Admin | Path `id` | None | `200` record | Cannot check out twice. Audited. | `401`, `403`, `404`, `409` |
| GET | `/absence-justifications` | List absence justifications. | BranchDirector, GeneralDirector, Admin | None | None | `200` list | Directors review requests. | `401`, `403` |
| POST | `/absence-justifications` | Submit absence justification. | Student, Teacher, directors/admin | None | attendanceRecordId, reason, evidenceUrl | `201` record | Attendance record must exist. | `401`, `403`, `404`, `422` |
| PATCH | `/absence-justifications/{id}/review` | Approve/reject justification. | BranchDirector, GeneralDirector, Admin | Path `id` | status, reviewNotes | `200` record | Status must be approved/rejected. Audited. | `401`, `403`, `404`, `422` |
| GET | `/reports/branches/summary` | Branch summary report. | BranchDirector, GeneralDirector, Admin | None | None | `200` report | BranchDirector receives only assigned branches; GeneralDirector/Admin receive consolidated visibility. Uses short actor-scoped memory cache. | `401`, `403` |
| GET | `/reports/scholarships/{studentId}/candidate?from=&to=` | Scholarship candidate check. | BranchDirector, GeneralDirector, Admin | Path studentId, optional ISO dates | None | `200` candidate | Candidate if attendance >=90% in two-month period. | `401`, `403` |
| POST | `/scholarship-evaluations` | Register scholarship evaluation. | BranchDirector, GeneralDirector, Admin | None | studentId, percentage, theoryScore, practiceScore, approved, optional from/to | `201` evaluation | Does not auto-approve; approval requires candidate and scores >=70. Audited. | `401`, `403`, `422` |
| GET | `/scholarship-evaluations` | List scholarship evaluations. | BranchDirector, GeneralDirector, Admin | None | None | `200` list | Director review evidence. | `401`, `403` |
| GET | `/reports/level-promotions/{studentId}/candidate?from=&to=` | Level promotion candidate check. | BranchDirector, GeneralDirector, Admin | Path studentId, optional ISO dates | None | `200` candidate | Candidate must be B1 and meet attendance threshold. | `401`, `403` |
| POST | `/level-promotion-evaluations` | Register promotion evaluation. | BranchDirector, GeneralDirector, Admin | None | studentId, consistencyScore, theoryScore, practiceScore, approved, optional from/to | `201` evaluation | Approved candidate can be moved from B1 to B2. Audited. | `401`, `403`, `422` |
| GET | `/level-promotion-evaluations` | List promotion evaluations. | BranchDirector, GeneralDirector, Admin | None | None | `200` list | Director evidence. | `401`, `403` |
| GET | `/reports/teachers/{teacherId}/payment` | Teacher payment calculation. | BranchDirector, GeneralDirector, Admin | Path teacherId | None | `200` report | Uses checked-out records only. | `401`, `403` |
| GET | `/audit-logs` | List audit logs. | GeneralDirector, Admin | None | None | `200` list | Restricted traceability. | `401`, `403` |

## Python Analytics API Reference

The Python Analytics API is implemented with FastAPI under `06Code/python-analytics-api`. It reuses the JWT session token issued by the Node Auth API and enforces the same resource-scope policy for students, teachers and assigned branches.

| Method | URI | Description | Required Role | Params/Query | Body | Success | Business/Validation | Errors |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/analytics/v1/health` | Python API health check. | Visitor | None | None | `200` service status | Confirms FastAPI service is alive. Uses `Cache-Control: public, max-age=60`. | `500` |
| GET | `/api/analytics/v1/students/{student_id}/attendance-risk` | Student attendance risk analytics. | Scoped authenticated | Path `student_id`; optional `from`, `to` ISO datetimes | None | `200` attendance rate, risk level, recommendation | Student sees own data; Teacher sees students from taught sessions; BranchDirector sees assigned branches. | `401`, `403`, `404` |
| GET | `/api/analytics/v1/students/{student_id}/scholarship-readiness` | Scholarship readiness analytics. | Scoped authenticated | Path `student_id`; optional `from`, `to` ISO datetimes | None | `200` attendance threshold comparison | Uses the active scholarship rule and resource-scope authorization. | `401`, `403`, `404` |
| GET | `/api/analytics/v1/branches/{branch_id}/performance-summary` | Branch performance analytics. | BranchDirector, GeneralDirector, Admin | Path `branch_id` | None | `200` branch totals, attendance rate, performance level | BranchDirector must be assigned to the requested branch. | `401`, `403`, `404` |
| GET | `/api/analytics/v1/teachers/{teacher_id}/workload-summary` | Teacher workload analytics. | Scoped authenticated | Path `teacher_id`; optional `from`, `to` ISO datetimes | None | `200` check-ins, completed hours, estimated pay | Teacher sees own workload; BranchDirector sees assigned branch teachers. | `401`, `403`, `404` |

## Validation Evidence
- Automated API validation command: `cd 06Code && npm run test:api:validation`
- Latest generated report: `03Documentation/api-validation-report.md`
- Latest JSON result evidence: `07Other/api-validation-results.json`
- Manual Postman verification assets: `postman/American-Latin-Class-API.postman_collection.json`, `postman/American-Latin-Class-Analytics-API.postman_collection.json` and `postman/American-Latin-Class.postman_environment.json`

The automated validation covers auth config, email/password login, mandatory first password change, director-created accounts, malformed Google token rejection, registered Google session creation, unregistered Google rejection, unverified Google email rejection, linked Google email mismatch rejection, JWT Bearer access, session revocation, revoked token rejection, anonymous/private redirects, RBAC failures, public enrollment validation, CRUD flows, attendance duplication rules, teacher check-in/check-out, absence review, reports, scholarship evaluations, promotion evaluations and audit log visibility.

## Role Test Seed
Run this after applying the database schema when you need manual role/permission testing:
```bash
cd 06Code
npm run db:seed:role-test
```

The seed creates or updates temporary login users for Admin, GeneralDirector, BranchDirector, Teacher and Student. Default local passwords are `adminALC2026*`, `generaldirectorALC2026*`, `branchdirectorALC2026*`, `teacherALC2026*` and `studentALC2026*`; override them with `SEED_*_PASSWORD` environment variables before running the seed. The BranchDirector user is assigned only to `ALC Santo Domingo Norte`, leaving `ALC Santo Domingo Central` available for negative permission tests.

## JSON Examples
Email/password login:
```json
{
  "email": "verification-admin-real-20260624154645@alc.test",
  "password": "{{login_password}}"
}
```

Google login:
```json
{
  "idToken": "eyJhbGciOi..."
}
```

Create academy account:
```json
{
  "email": "student@alc.edu",
  "name": "Student Name",
  "role": "Student",
  "temporaryPassword": "studentALC2026*"
}
```

Change temporary password:
```json
{
  "currentPassword": "studentALC2026*",
  "newPassword": "studentALC2027*"
}
```

Login response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "sessionToken": "eyJhbGciOi...",
    "tokenType": "Bearer",
    "expiresInMinutes": 120,
    "user": {
      "id": "d8c025f6-bcd0-4f25-a6b1-1486338678e7",
      "email": "student@example.com",
      "name": "Student Example",
      "role": "Student",
      "mustChangePassword": true
    }
  }
}
```

Postman authenticated request:
```http
GET /api/v1/auth/me
Authorization: Bearer {{session_token}}
```

Logout invalidates the backend session:
```http
POST /api/v1/auth/logout
Authorization: Bearer {{session_token}}
```

After logout, the same token must return `401`:
```http
GET /api/v1/auth/me
Authorization: Bearer {{session_token}}
```

Python analytics authenticated request:
```http
GET /api/analytics/v1/students/{{student_id}}/attendance-risk
Authorization: Bearer {{session_token}}
```

Python analytics unauthorized response:
```json
{
  "success": false,
  "message": "Authentication required",
  "data": null
}
```

Student attendance:
```json
{
  "studentId": "85f4bbe9-5d5f-4126-89b6-ddd9de432885",
  "classSessionId": "76f37581-dbbc-4201-bb13-67fbc86f6d60",
  "status": "present",
  "notes": "On time"
}
```

Scholarship evaluation:
```json
{
  "studentId": "85f4bbe9-5d5f-4126-89b6-ddd9de432885",
  "percentage": 50,
  "theoryScore": 82,
  "practiceScore": 91,
  "approved": true
}
```

Error response:
```json
{
  "success": false,
  "message": "Insufficient permissions",
  "details": null
}
```
