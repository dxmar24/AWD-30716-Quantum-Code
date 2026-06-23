# REST API Documentation

All endpoints are prefixed with `/api/v1`. Header: `Content-Type: application/json`. Authenticated endpoints require cookie `alc_session` or `Authorization: Bearer <token>`.

## Auth/session
### POST `/auth/google`
Description: Login/register with Google ID token. Role: Visitor. Body: `{ "idToken": "jwt" }`. Success 200 returns user. Errors: 401 invalid token, 422 validation.

### GET `/auth/me`
Description: Current session. Role: any authenticated. Success 200 returns user. Error 401 expired/missing session.

### POST `/auth/logout`
Description: Revokes session and clears cookie. Role: any authenticated or anonymous. Success 200.

## Core resources
`GET /branches`, `GET /students`, `GET /teachers`, `GET /class-groups`, `GET /class-sessions`: list resources. Role: authenticated.
`POST` same resources: create resource. Role: BranchDirector, GeneralDirector, Admin.
`GET /{resource}/{id}`: retrieve by UUID. Role: authenticated. Error 404 not found.

## Student attendance
### POST `/student-attendance`
Role: Teacher, BranchDirector, GeneralDirector, Admin. Body: `{ "studentId":"uuid", "classSessionId":"uuid", "status":"present|absent|justified|late", "notes":"optional" }`. Business: one record per student/session in production schema.

## Teacher attendance
### POST `/teacher-attendance/check-in`
Role: Teacher, BranchDirector, GeneralDirector, Admin. Body: `{ "teacherId":"uuid", "classSessionId":"uuid" }`.
### PATCH `/teacher-attendance/{id}/check-out`
Role: Teacher, BranchDirector, GeneralDirector, Admin. Path: teacher attendance UUID.

## Reports
### GET `/reports/branches/summary`
Role: GeneralDirector, Admin. Returns active students by branch.
### GET `/reports/scholarships/{studentId}/candidate?from=&to=`
Role: BranchDirector, GeneralDirector, Admin. Business: candidate only; director evaluation is required for approval.
### GET `/reports/teachers/{teacherId}/payment`
Role: BranchDirector, GeneralDirector, Admin. Returns hours, hourly rate and amount.

## Audit logs
### GET `/audit-logs`
Role: GeneralDirector, Admin. Returns administrative/action audit records.
