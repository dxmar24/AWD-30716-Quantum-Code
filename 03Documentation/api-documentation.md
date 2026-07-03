# REST API Documentation

Node API base URI: `/api/v1`

Python Analytics API base URI: `/api/analytics/v1`

Common headers:
- `Content-Type: application/json`
- Authenticated endpoints require cookie `alc_session` or `Authorization: Bearer <session-token>`.

Response envelope:
```json
{ "success": true, "message": "OK", "data": {} }
```
```json
{ "success": false, "message": "Validation failed", "details": {} }
```

Common status codes: `200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`, `500`.

## Endpoint Reference
| Method | URI | Description | Required Role | Params/Query | Body | Success | Business/Validation | Errors |
|---|---|---|---|---|---|---|---|---|
| GET | `/auth/config` | Public auth client configuration for the React login page. | Visitor | None | None | `200` Google client id | Does not expose secrets; client id is public OAuth metadata. | `500` |
| POST | `/auth/login` | Postman/backend verification login with configured email and password. | Visitor | None | `{ "email": "admin@alc.edu", "password": "secret" }` | `200` user, JWT `sessionToken`, Bearer token type and HttpOnly cookie | Uses configured demo credentials and an existing internal user. Rate limited. Intended for academic Postman verification. | `401`, `403`, `422` |
| POST | `/auth/google` | Login/register with Google ID token. | Visitor | None | `{ "idToken": "jwt" }` | `200` user, JWT `sessionToken`, Bearer token type and HttpOnly cookie | Token must be valid Google ID token in production; internal role is app-owned. Rate limited. | `401`, `422` |
| GET | `/auth/me` | Current session user. | Authenticated | None | None | `200` user | Session must exist, not revoked and not expired. | `401` |
| POST | `/auth/logout` | Revoke session and clear cookie. | Any | None | None | `200` | Revokes server session/token hash. | `200` even without active session |
| POST | `/enrollment-requests` | Public enrollment request. | Visitor | None | fullName, email, optional phone/preferredBranch/styleInterest/message | `201` request | Email format and name length validated. | `422` |
| GET | `/enrollment-requests` | List public requests. | BranchDirector, GeneralDirector, Admin | None | None | `200` list | Restricted to directors/admin. | `401`, `403` |
| GET | `/users` | List users. | GeneralDirector, Admin | None | None | `200` list | Internal roles only. | `401`, `403` |
| PATCH | `/users/{id}/role` | Assign internal role. | Admin | Path `id` | `{ "role": "Teacher" }` | `200` user | Role must be Student, Teacher, BranchDirector, GeneralDirector or Admin. Audited. | `401`, `403`, `404`, `422` |
| GET | `/roles` | List roles. | Authenticated | None | None | `200` list | Roles seeded by app. | `401` |
| GET | `/permissions` | List permissions. | GeneralDirector, Admin | None | None | `200` list | Permission catalog seeded. | `401`, `403` |
| GET | `/branches` | List branches. | Authenticated | None | None | `200` list | Five academy branches seeded. | `401` |
| POST | `/branches` | Create branch. | BranchDirector, GeneralDirector, Admin | None | name, city, active | `201` branch | Validates name length. | `401`, `403`, `422` |
| PATCH | `/branches/{id}` | Update branch. | BranchDirector, GeneralDirector, Admin | Path `id` | partial branch | `200` branch | Auditable academic data change. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/students` | List/create/update students. | Read: authenticated. Write: directors/admin | Path `id` on item routes | userId, branchId, fullName, level, active | `200`/`201` | Level must be `B1` or `B2`. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/teachers` | List/create/update teachers. | Read: authenticated. Write: directors/admin | Path `id` | userId, branchId, fullName, hourlyRate, active | `200`/`201` | Hourly rate cannot be negative. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/dance-categories` | Manage dance categories. | Read: authenticated. Write: directors/admin | Path `id` | name | `200`/`201` | Urban, Tropical, Ethnic seeded. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/dance-styles` | Manage dance styles. | Read: authenticated. Write: directors/admin | Path `id` | categoryId, name | `200`/`201` | Style belongs to a category. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/class-groups` | Manage class groups. | Read: authenticated. Write: directors/admin | Path `id` | branchId, styleId, teacherId, name, level, active | `200`/`201` | Group ties branch/style/teacher/level. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/class-sessions` | Manage scheduled sessions. | Read: authenticated. Write: directors/admin | Path `id` | classGroupId, startsAt, endsAt, status | `200`/`201` | Datetimes must be ISO strings. | `401`, `403`, `404`, `422` |
| POST | `/student-attendance` | Record student attendance. | Teacher, BranchDirector, GeneralDirector, Admin | None | studentId, classSessionId, status, notes | `201` record | One record per student/session. Status: present, absent, justified, late. Audited. | `401`, `403`, `404`, `409`, `422` |
| POST | `/teacher-attendance/check-in` | Teacher check-in. | Teacher, BranchDirector, GeneralDirector, Admin | None | teacherId, optional classSessionId | `201` record | One open check-in per teacher. Audited. | `401`, `403`, `404`, `409`, `422` |
| PATCH | `/teacher-attendance/{id}/check-out` | Teacher check-out. | Teacher, BranchDirector, GeneralDirector, Admin | Path `id` | None | `200` record | Cannot check out twice. Audited. | `401`, `403`, `404`, `409` |
| GET | `/absence-justifications` | List absence justifications. | BranchDirector, GeneralDirector, Admin | None | None | `200` list | Directors review requests. | `401`, `403` |
| POST | `/absence-justifications` | Submit absence justification. | Student, Teacher, directors/admin | None | attendanceRecordId, reason, evidenceUrl | `201` record | Attendance record must exist. | `401`, `403`, `404`, `422` |
| PATCH | `/absence-justifications/{id}/review` | Approve/reject justification. | BranchDirector, GeneralDirector, Admin | Path `id` | status, reviewNotes | `200` record | Status must be approved/rejected. Audited. | `401`, `403`, `404`, `422` |
| GET | `/reports/branches/summary` | Branch summary report. | GeneralDirector, Admin | None | None | `200` report | Consolidated branch visibility. | `401`, `403` |
| GET | `/reports/scholarships/{studentId}/candidate?from=&to=` | Scholarship candidate check. | BranchDirector, GeneralDirector, Admin | Path studentId, optional ISO dates | None | `200` candidate | Candidate if attendance >=90% in two-month period. | `401`, `403` |
| POST | `/scholarship-evaluations` | Register scholarship evaluation. | BranchDirector, GeneralDirector, Admin | None | studentId, percentage, theoryScore, practiceScore, approved, optional from/to | `201` evaluation | Does not auto-approve; approval requires candidate and scores >=70. Audited. | `401`, `403`, `422` |
| GET | `/scholarship-evaluations` | List scholarship evaluations. | BranchDirector, GeneralDirector, Admin | None | None | `200` list | Director review evidence. | `401`, `403` |
| GET | `/reports/level-promotions/{studentId}/candidate?from=&to=` | Level promotion candidate check. | BranchDirector, GeneralDirector, Admin | Path studentId, optional ISO dates | None | `200` candidate | Candidate must be B1 and meet attendance threshold. | `401`, `403` |
| POST | `/level-promotion-evaluations` | Register promotion evaluation. | BranchDirector, GeneralDirector, Admin | None | studentId, consistencyScore, theoryScore, practiceScore, approved, optional from/to | `201` evaluation | Approved candidate can be moved from B1 to B2. Audited. | `401`, `403`, `422` |
| GET | `/level-promotion-evaluations` | List promotion evaluations. | BranchDirector, GeneralDirector, Admin | None | None | `200` list | Director evidence. | `401`, `403` |
| GET | `/reports/teachers/{teacherId}/payment` | Teacher payment calculation. | BranchDirector, GeneralDirector, Admin | Path teacherId | None | `200` report | Uses checked-out records only. | `401`, `403` |
| GET | `/audit-logs` | List audit logs. | GeneralDirector, Admin | None | None | `200` list | Restricted traceability. | `401`, `403` |

## Python Analytics API Reference

The Python Analytics API is implemented with FastAPI under `06Code/python-analytics-api`. It reuses the JWT session token issued by the Node Auth API, so Postman can test it with the same `{{session_token}}`.

| Method | URI | Description | Required Role | Params/Query | Body | Success | Business/Validation | Errors |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/analytics/v1/health` | Python API health check. | Visitor | None | None | `200` service status | Confirms FastAPI service is alive. | `500` |
| GET | `/api/analytics/v1/students/{student_id}/attendance-risk` | Student attendance risk analytics. | Authenticated | Path `student_id`; optional `from`, `to` ISO datetimes | None | `200` attendance rate, risk level, recommendation | Reads attendance records and class sessions. Risk is high below 75%, medium below 90%, low at 90% or above. | `401`, `404` |
| GET | `/api/analytics/v1/students/{student_id}/scholarship-readiness` | Scholarship readiness analytics. | Authenticated | Path `student_id`; optional `from`, `to` ISO datetimes | None | `200` attendance threshold comparison | Uses the active scholarship rule and computes missing percentage points. | `401`, `404` |
| GET | `/api/analytics/v1/branches/{branch_id}/performance-summary` | Branch performance analytics. | Authenticated | Path `branch_id` | None | `200` branch totals, attendance rate, performance level | Aggregates students, teachers, groups, sessions, attendance and pending enrollments. | `401`, `404` |
| GET | `/api/analytics/v1/teachers/{teacher_id}/workload-summary` | Teacher workload analytics. | Authenticated | Path `teacher_id`; optional `from`, `to` ISO datetimes | None | `200` check-ins, completed hours, estimated pay | Uses checked-out teacher attendance records and teacher hourly rate. | `401`, `404` |

## Validation Evidence
- Automated API validation command: `cd 06Code && npm run test:api:validation`
- Latest generated report: `03Documentation/api-validation-report.md`
- Latest JSON result evidence: `07Other/api-validation-results.json`
- Manual Postman verification assets: `postman/American-Latin-Class-API.postman_collection.json`, `postman/American-Latin-Class-Analytics-API.postman_collection.json` and `postman/American-Latin-Class.postman_environment.json`

The automated validation covers auth config, Postman email/password login, malformed Google token rejection, Google session creation with mock test tokens, JWT Bearer access, session revocation, revoked token rejection, anonymous/private redirects, RBAC failures, public enrollment validation, CRUD flows, attendance duplication rules, teacher check-in/check-out, absence review, reports, scholarship evaluations, promotion evaluations and audit log visibility.

## JSON Examples
Postman password login:
```json
{
  "email": "verification-admin-real-20260624154645@alc.test",
  "password": "AmericanLatin2026!"
}
```

Google login:
```json
{
  "idToken": "eyJhbGciOi..."
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
      "role": "Student"
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
