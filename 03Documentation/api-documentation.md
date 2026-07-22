# REST API Documentation

Node API base URI: `/api/v1`

Python Analytics API base URI: `/api/analytics/v1`

Common headers:
- `Content-Type: application/json`
- Authenticated endpoints require cookie `alc_session` or `Authorization: Bearer <session-token>`.
- Cookie-authenticated state changes also require the double-submit CSRF value; Bearer-authenticated API clients are exempt from the cookie CSRF check.
- `X-Request-Id` is accepted/generated and returned for operational traceability. Production errors do not expose stacks or database internals.
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
| `GET /health/live`, `GET /health/ready` | Public but `no-store`; readiness reflects current persistence state. |
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
| GET | `/health/live` | Node process liveness probe. | Visitor | None | None | `200` minimal service/status/timestamp | Proves that Express can answer; does not imply database availability and exposes no infrastructure details. | `500` only on process failure |
| GET | `/health/ready` | Node readiness probe. | Visitor | None | None | `200` minimal ready status | Performs a database read. Returns a sanitized body and `503` when persistence is unavailable; no connection error/details are exposed. | `503` |
| GET | `/auth/config` | Public auth client configuration for the React login page. | Visitor | None | None | `200` Google client id | Does not expose secrets; client id is public OAuth metadata. Uses `Cache-Control: public, max-age=3600`. | `500` |
| POST | `/auth/login` | Email/password login for existing academy users. | Visitor | None | `{ "email": "user@example.invalid", "password": "<local-secret>" }` | `200` user and Secure HttpOnly cookie | Uses `users.password_hash`. Temporary-password users must change password before protected flows. Bearer token response exposure and fallback credentials are test/local-only. Rate limited. | `401`, `422` |
| POST | `/auth/google` | Google login for existing academy users. | Visitor | None | `{ "idToken": "jwt" }` | `200` user and Secure HttpOnly cookie | Google tokens are cryptographically verified outside tests. Google never creates an unregistered account and inactive users are rejected. | `401`, `409`, `422` |
| GET | `/auth/me` | Current session user. | Authenticated | None | None | `200` user | Session must exist, not revoked and not expired. | `401` |
| POST | `/auth/change-password` | Change the signed-in user's password. | Authenticated | None | `{ "currentPassword": "temporary", "newPassword": "newSecret123" }` | `200` user and rotated session | Clears the flag, stores `password_changed_at`, revokes every prior session and rotates the cookie/token. | `401`, `422` |
| POST | `/auth/logout` | Revoke session and clear cookie. | Any | None | None | `200` | Revokes server session/token hash. | `200` even without active session |
| GET | `/public/branches` | Public active branch catalog for the enrollment form. | Visitor | None | None | `200` list | Returns id, name and city for active branches. Uses public cache and memory-cache evidence headers. | `500` |
| POST | `/enrollment-requests` | Public enrollment request. | Visitor | None | fullName, email, optional phone/branchId/preferredBranch/styleInterest/message | `201` request | Branch must be active. Rejects another active request for the same normalized email/branch in the prior 24 hours. Rate limited and audited without an actor. | `404`, `409`, `422` |
| GET | `/enrollment-requests` | List public requests. | BranchDirector, GeneralDirector, Admin | None | None | `200` list | Restricted to directors/admin. | `401`, `403` |
| PATCH | `/enrollment-requests/{id}/status` | Advance a lead through the academy pipeline. | BranchDirector, GeneralDirector, Admin | Path `id` | status, optional notes/followUpAt/convertedStudentId | `200` lead | Graph: pending→contacted/lost; contacted→trial_scheduled/enrolled/lost; trial_scheduled→contacted/enrolled/lost. Trial needs a future date, lost needs a reason, enrolled needs an active matching student. Audited. | `401`, `403`, `404`, `409`, `422` |
| GET | `/users` | List users. | GeneralDirector, Admin | None | None | `200` list | Internal roles only. | `401`, `403` |
| POST | `/users` | Create an academy user and send an access invitation. | GeneralDirector, Admin | None | email, name, role, active, branchIds, studentProfile, teacherProfile | `201` user, linked profile and safe email-delivery confirmation | The generated password is delivered only by email and is never returned by the API. The account remains inactive if delivery fails. New users require a password change. Student/Teacher need a compatible profile; BranchDirector needs branch access. | `401`, `403`, `404`, `409`, `422`, `502` |
| POST | `/users/{id}/resend-invitation` | Generate and resend an access invitation. | GeneralDirector, Admin | Path `id` | None | `200` user and safe delivery confirmation | Sends a new temporary password, activates the role-ready account, revokes old sessions and never exposes the credential in HTTP responses. Audited. | `401`, `403`, `404`, `422`, `502` |
| POST | `/users/{id}/reset-password` | Reset another user's password by email. | Admin | Path `id` | None | `200` user and safe delivery confirmation | Sends the temporary password before replacing the stored hash, revokes old sessions and requires password change. Self-reset is rejected. | `401`, `403`, `404`, `422`, `502` |
| PATCH | `/users/{id}/role` | Assign internal role. | Admin | Path `id` | `{ "role": "Teacher" }` | `200` user | Student and Teacher roles require an existing linked profile; BranchDirector requires assigned branch access. Admin role is Admin-only. Audited. | `401`, `403`, `404`, `422` |
| GET | `/users/{id}/branch-access` | List branch access assigned to a user. | GeneralDirector, Admin | Path `id` | None | `200` list | Used to scope BranchDirector permissions to specific branches. | `401`, `403`, `404` |
| PATCH | `/users/{id}/branch-access` | Replace branch access assigned to a user. | GeneralDirector, Admin | Path `id` | `{ "branchIds": ["uuid"] }` | `200` list | Target user must be BranchDirector, at least one branch is required and IDs must exist. Audited atomically. | `401`, `403`, `404`, `422` |
| GET | `/roles` | List roles. | Authenticated | None | None | `200` list | Roles seeded by app. Private HTTP cache and memory-cache `MISS/HIT` headers. | `401` |
| GET | `/permissions` | List permissions. | GeneralDirector, Admin | None | None | `200` list | Permission catalog seeded. Private HTTP cache and memory-cache `MISS/HIT` headers. | `401`, `403` |
| GET | `/branches` | List branches. | Authenticated | None | None | `200` list | Five academy branches seeded. Actor-scoped memory cache; branch writes invalidate the list. | `401` |
| POST | `/branches` | Create branch. | GeneralDirector, Admin | None | name, city, active | `201` branch | Global structural data; BranchDirector cannot create it. | `401`, `403`, `422` |
| PATCH | `/branches/{id}` | Update branch. | GeneralDirector, Admin | Path `id` | partial branch | `200` branch | Audited global structural change; BranchDirector cannot edit it. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/students` | List/create/update students. | Read: scoped authenticated. Write: scoped directors/admin | Path `id` on item routes | userId, branchId, fullName, level, active | `200`/`201` | BranchDirector is limited to assigned branches; Student sees only own profile. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/teachers` | List/create/update teachers. | Read: scoped authenticated. Write: scoped directors/admin | Path `id` | userId, branchId, fullName, hourlyRate, active | `200`/`201` | BranchDirector is branch-scoped and cannot set/change `hourlyRate`; creation forces the standard 12.50 rate when omitted/unauthorized. GeneralDirector/Admin manage rates. Teacher sees only own profile. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/dance-categories` | Manage dance categories. | Read: authenticated. Write: GeneralDirector/Admin | Path `id` | name | `200`/`201` | Global catalog data is not branch-scoped. Read lists use private memory cache; writes invalidate catalog cache. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/dance-styles` | Manage dance styles. | Read: authenticated. Write: GeneralDirector/Admin | Path `id` | categoryId, name | `200`/`201` | Global catalog data is not branch-scoped. Read lists use private memory cache; writes invalidate catalog cache. | `401`, `403`, `404`, `422` |
| GET/POST/PATCH | `/class-groups` | Manage class groups. | Read: scoped authenticated. Write: scoped directors/admin | Path `id` | branchId, optional styleId/teacherId, name, level, active, capacity | `200`/`201` | Capacity is 1–200 and cannot be lowered below occupied seats. Teacher must be active/same branch; when `teacher_styles` declares specialties, group style must match one of them (no declaration does not block). Teacher sees assigned groups. | `401`, `403`, `404`, `409`, `422` |
| GET/POST/PATCH | `/class-sessions` | Manage scheduled sessions. | Read: scoped authenticated. Write: scoped directors/admin | Path `id` | classGroupId, optional name, startsAt, endsAt, status, cancellationReason | `200`/`201` | New sessions start scheduled, use an active group, last ≤6h and cannot overlap the same group/teacher. Completion requires finalized attendance plus actor/time metadata; cancellation needs a reason. Completed/cancelled rows are immutable. | `401`, `403`, `404`, `409`, `422` |
| GET/POST/PATCH | `/academy-events` | Manage branch events and show income. | Read: scoped authenticated. Write: scoped directors/admin | Path `id` | branchId, title, description, level, startsAt/endsAt, location, showIncome, active | `200`/`201` | Event dates must be coherent; scope follows branch. Reported show income is recognized only as of the event date. | `401`, `403`, `404`, `422` |
| DELETE | `/academy-events/{id}` | Soft-remove an event. | BranchDirector, GeneralDirector, Admin | Path `id` | None | `200` inactive event | Does not destroy historical evidence; audited and report cache invalidated. | `401`, `403`, `404` |
| GET | `/class-group-enrollments` | List visible group memberships/history. | Authenticated | None | None | `200` scoped list | Student sees own links; Teacher sees assigned-group links; directors/admin see their branch/global scope. | `401`, `403` |
| POST | `/class-group-enrollments` | Enroll or re-enroll a student in a group. | BranchDirector, GeneralDirector, Admin | None | studentId, classGroupId, optional status/startsAt/endsAt/enrolledAt/withdrawalReason | `201` episode | Branch/level/active resources must match. Active/trial consume capacity; overflow is atomically waitlisted. Re-enrollment needs every prior episode withdrawn/completed with `endsAt`, a non-overlapping new interval and no current active/trial/waitlisted/frozen episode. Audit links episode number/previous IDs. | `401`, `403`, `404`, `409`, `422` |
| PATCH | `/class-group-enrollments/{id}` | Move one enrollment episode through its lifecycle. | BranchDirector, GeneralDirector, Admin | Path `id` | status/startsAt/endsAt/withdrawalReason | `200` episode | Uses explicit transition graph/effective dates and rejects overlap with another episode. Withdrawal needs a reason; withdrawn/completed are terminal for that row. Re-enrollment uses POST and preserves history. | `401`, `403`, `404`, `409`, `422` |
| DELETE | `/class-group-enrollments/{id}` | Delete an erroneous enrollment with no attendance history. | BranchDirector, GeneralDirector, Admin | Path `id` | None | `200` deleted episode | Refuses deletion when any attendance record belongs to the student and group during the enrollment period. Historical enrollments must be withdrawn or completed instead. Audited. | `401`, `403`, `404`, `409` |
| GET | `/class-sessions/{id}/roster` | Load the session's historical roster and current marks. | Teacher, BranchDirector, GeneralDirector, Admin | Path `id` | None | `200` session, group, state, roster | Selects the enrollment episode covering the session date. Access is assigned teacher or authorized branch/global director; waitlisted students do not enter the roster. | `401`, `403`, `404` |
| PUT | `/class-sessions/{id}/attendance` | Save a draft or finalize roster attendance. | Teacher, BranchDirector, GeneralDirector, Admin | Path `id` | state (`draft`/`finalized`), records[], optional correctionReason | `200` batch result | Draft is allowed after class starts. Finalization/correction waits until `endsAt`, requires exact roster and completes the session. Cannot return to draft. Final correction is director-only, reasoned, versioned and idempotent when unchanged. | `401`, `403`, `404`, `409`, `422` |
| GET | `/student-payments` and `/{id}` | List/read visible financial ledger rows. | Authenticated | Optional path `id` | None | `200` scoped data | Student sees own ledger; BranchDirector sees assigned branch; global roles see all. Effective overdue status is derived from due date. | `401`, `403`, `404` |
| POST | `/student-payments` | Create a charge. | BranchDirector, GeneralDirector, Admin | None | studentId, amount, concept, period, status, optional paidAt/dueAt/notes | `201` charge | Branch is derived from the active student. Positive amount and `YYYY-MM`; no active duplicate for student/period/normalized concept. Dates/status must agree. | `401`, `403`, `404`, `409`, `422` |
| PATCH | `/student-payments/{id}` | Correct or collect an unposted charge. | BranchDirector, GeneralDirector, Admin | Path `id` | partial charge plus correctionReason when terms/cancellation change | `200` charge | Paid/cancelled rows are immutable; cancellation and financial-term changes require reason. Student cannot be transferred. | `401`, `403`, `404`, `409`, `422` |
| POST | `/student-payments/{id}/reversal` | Reverse a posted paid charge. | GeneralDirector, Admin | Path `id` | `{ "reason": "..." }` | `201` linked negative ledger row | Exactly one reversal per paid charge; a reversal cannot be reversed. Original stays immutable. | `401`, `403`, `404`, `409`, `422` |
| PATCH/DELETE | `/students/me/profile-photo` | Set or remove own student photo. | Student | None | PATCH: `profilePhotoUrl` | `200` profile | Browser accepts an original PNG/JPEG/WebP up to 8 MB, crops it square and compresses locally to WebP/JPEG data URL ≤90,000 characters, below the 102,400-byte JSON limit. HTTPS URL is also valid. Never permits another profile. Audited. | `401`, `403`, `404`, `413`, `422` |
| GET | `/student-attendance` | List visible student attendance records. | Authenticated | None | None | `200` list | Student sees own records, Teacher sees accessible class records, directors/admin see scoped records. | `401`, `403` |
| POST | `/student-attendance` | Record one attendance mark (compatibility flow). | Teacher, BranchDirector, GeneralDirector, Admin | None | studentId, classSessionId, status, notes, optional correctionReason | `201`/`200` record | Student must belong to the session roster; status is present/late/absent. Duplicate draft marks are rejected. Final correction follows the same director/reason/version controls as batch attendance. | `401`, `403`, `404`, `409`, `422` |
| GET | `/teacher-attendance` | List visible teacher shifts. | Teacher, BranchDirector, GeneralDirector, Admin | None | None | `200` scoped shifts | Teacher sees own records; directors are branch/global scoped. | `401`, `403` |
| POST | `/teacher-attendance/check-in` | Teacher check-in. | Teacher, BranchDirector, GeneralDirector, Admin | None | teacherId, classSessionId | `201` record | Session must be scheduled, active and assigned to the teacher. Window is from 60 minutes before to 60 minutes after class; duplicate session/open shift rejected. Snapshots rate. | `401`, `403`, `404`, `409`, `422` |
| PATCH | `/teacher-attendance/{id}/check-out` | Teacher check-out. | Teacher, BranchDirector, GeneralDirector, Admin | Path `id` | None | `200` record | Cannot close twice. Stores payable minutes capped by actual time, scheduled duration +30 minutes and 12 hours. Audited. | `401`, `403`, `404`, `409` |
| GET | `/absence-justifications` | List visible absence justifications. | Authenticated | None | None | `200` scoped list | Student sees own requests; teacher/director visibility follows academic/branch scope. | `401`, `403` |
| POST | `/absence-justifications` | Submit absence justification. | Student, Teacher, directors/admin | None | `multipart/form-data`: attendanceRecordId, reason, optional `evidence` file | `201` request without file bytes | Evidence accepts valid JPEG, PNG, WebP or PDF content up to 5 MB. The signature must match the declared MIME type. Attendance must exist and remain absent; access is resource-scoped. | `401`, `403`, `404`, `413`, `422` |
| GET | `/absence-justifications/{id}/evidence` | View a private justification attachment. | Authenticated and resource-scoped | Path `id` | None | `200` original file bytes | Uses the same student/teacher/branch scope as the justification, sends `private, no-store` and never exposes a public storage URL. | `401`, `403`, `404` |
| PATCH | `/absence-justifications/{id}/review` | Approve/reject justification. | BranchDirector, GeneralDirector, Admin | Path `id` | status, optional reviewNotes | `200` request | Pending reviews only. Approval excludes the absence from adjusted denominator while raw physical absence remains visible. Audited. | `401`, `403`, `404`, `409`, `422` |
| GET | `/reports/branches/summary?from=&to=` | Branch summary report. | BranchDirector, GeneralDirector, Admin | Optional ISO period | None | `200` branch metrics/quality alerts | Only finalized, non-cancelled academic evidence. Includes students, raw/adjusted attendance, punctuality, occupancy/waitlist, income/reversals, receivables/aging and quality alerts. Scoped and cached 30s. | `401`, `403`, `422` |
| GET | `/reports/general?from=&to=` | Consolidated management report. | GeneralDirector, Admin | Optional ISO period, maximum 1095 days | None | `200` totals, distributions, six-month trends, funnel, branches and alerts | `generatedAt` is execution time; `asOf` is the earlier of `to` and generation time. Income distinguishes gross, reversals and net. | `401`, `403`, `422` |
| GET | `/reports/branches/{branchId}/detail?from=&to=` | Single-branch management report. | BranchDirector, GeneralDirector, Admin | Path branch and optional ISO period | None | `200` branch, trends, distributions, funnel, alerts | BranchDirector only for assigned branches. Uses the same formulas/as-of contract. | `401`, `403`, `404`, `422` |
| GET | `/reports/scholarships/{studentId}/candidate?from=&to=` | Scholarship candidate check. | BranchDirector, GeneralDirector, Admin | Path studentId, optional ISO dates | None | `200` candidate | Active student, active threshold (default 90%) and at least eight finalized accountable sessions. Approved excuses are excluded only from adjusted denominator. | `401`, `403`, `422` |
| POST | `/scholarship-evaluations` | Register scholarship evaluation. | BranchDirector, GeneralDirector, Admin | None | studentId, percentage, theoryScore, practiceScore, approved, optional from/to | `201` evaluation | Transactional candidate calculation; approval requires eligibility and scores ≥70. Persists the evaluation window and permits later cycles, but only one approved evaluation per student/same window. Audited. | `401`, `403`, `409`, `422` |
| GET | `/scholarship-evaluations` | List scholarship evaluations. | BranchDirector, GeneralDirector, Admin | None | None | `200` list | Director review evidence. | `401`, `403` |
| GET | `/reports/level-promotions/{studentId}/candidate?from=&to=` | Level promotion candidate check. | BranchDirector, GeneralDirector, Admin | Path studentId, optional ISO dates | None | `200` candidate | Active B1, at least 85% adjusted attendance and eight finalized accountable sessions. | `401`, `403`, `422` |
| POST | `/level-promotion-evaluations` | Register promotion evaluation. | BranchDirector, GeneralDirector, Admin | None | studentId, consistencyScore, theoryScore, practiceScore, approved, optional from/to | `201` evaluation | Candidacy, duplicate check, evaluation, atomic B1→B2 update and audit share a serializable transaction. Only one approved B1→B2 transition per student. | `401`, `403`, `409`, `422` |
| GET | `/level-promotion-evaluations` | List promotion evaluations. | BranchDirector, GeneralDirector, Admin | None | None | `200` list | Director evidence. | `401`, `403` |
| GET | `/reports/teachers/{teacherId}/payment?from=&to=` | Teacher payment calculation. | BranchDirector, GeneralDirector, Admin | Path teacherId and optional ISO dates | None | `200` totals and shift breakdown | Closed records only; uses historical payable minutes/rate snapshot and validates range up to 1095 days. | `401`, `403`, `422` |
| GET | `/audit-logs` | Filter/paginate audit logs. | GeneralDirector, Admin | action, entity, actorUserId, from, to, limit 1–200, offset | None | `200` newest-first list plus `X-Total-Count/Limit/Offset` | Returns actor identity and sanitized metadata; invalid or reversed dates are rejected. | `401`, `403`, `422` |

## Python Analytics API Reference

The Python Analytics API is implemented with FastAPI under `06Code/apis/python-analytics-api`. It reuses the JWT session token issued by the Node Auth API and enforces the same resource-scope policy for students, teachers and assigned branches.

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

The automated suites cover fail-closed configuration, liveness/readiness behavior, password and Google login, first-password rotation, JWT/session revocation, CSRF/cookie behavior, RBAC/resource scope, public lead validation, academic CRUD, enrollment/capacity/waitlist, session conflicts/lifecycle, roster draft/final/correction, teacher shift/payroll controls, absence review, financial ledger/reversals, rule evaluation, report formulas/data-quality alerts and filtered audit visibility.

## Role Test Seed
Run this after applying the database schema when you need manual role/permission testing:
```bash
cd 06Code
npm run db:seed:role-test
```

The seed requires explicit local `SEED_*_EMAIL` and `SEED_*_PASSWORD` values. It is blocked outside an opted-in localhost development database, marks password accounts for mandatory rotation and never prints credentials.

## JSON Examples
Email/password login:
```json
{
  "email": "local-admin@example.invalid",
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
  "email": "new-student@example.invalid",
  "name": "Student Name",
  "role": "Student",
  "studentProfile": {
    "branchId": "<branch-uuid>",
    "level": "B1"
  }
}
```

Safe account-creation response excerpt:
```json
{
  "user": { "email": "new-student@example.invalid", "mustChangePassword": true },
  "invitation": { "status": "sent", "recipient": "new-student@example.invalid", "transport": "smtp" },
  "message": "The account was registered and the temporary password was sent by email."
}
```

The response intentionally has no `temporaryPassword` field.

Change temporary password:
```json
{
  "currentPassword": "<one-time-secret>",
  "newPassword": "<new-unique-secret>"
}
```

Login response in test or explicitly opted-in local API-client mode (deployed responses omit `sessionToken` and `tokenType`):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "sessionToken": "eyJhbGciOi...",
    "tokenType": "Bearer",
    "expiresInMinutes": 120,
    "user": {
      "id": "<user-id>",
      "email": "student@example.invalid",
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

Finalize a complete roster (use `draft` while it is incomplete):
```json
{
  "state": "finalized",
  "records": [
    { "studentId": "85f4bbe9-5d5f-4126-89b6-ddd9de432885", "status": "present", "notes": "On time" }
  ]
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
