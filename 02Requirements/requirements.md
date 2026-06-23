# Requirements

## Functional requirements
FR-01 Public landing page shows academy information, branches, styles, levels, contact and enrollment form.
FR-02 Users authenticate with Google OAuth and internal application roles.
FR-03 Directors manage branches, students, teachers, styles, class groups and sessions.
FR-04 Teachers/directors record student attendance.
FR-05 Teachers check in and check out to calculate worked hours.
FR-06 Directors review absence justifications.
FR-07 System marks scholarship candidates at >=90% attendance in a two-month period; directors record final evaluations.
FR-08 System marks promotion candidates; directors record theoretical and practical evaluations.
FR-09 Directors access branch and consolidated reports.
FR-10 Administrative actions are audited.

## Non-functional requirements
Secure HttpOnly cookies, no-store private pages, rate-limited auth, restricted CORS, normalized PostgreSQL, REST `/api/v1`, clean architecture, SOLID, tests and no secrets in repository.

## Role/permission matrix
| Feature | Student | Teacher | BranchDirector | GeneralDirector | Admin |
|---|---:|---:|---:|---:|---:|
| View own profile | X | X | X | X | X |
| Record student attendance |  | X | X | X | X |
| Teacher check-in/out |  | X | X | X | X |
| Manage branch academic data |  |  | X | X | X |
| Consolidated reports |  |  |  | X | X |
| Audit logs |  |  |  | X | X |

## Business rules
- Scholarship candidate requires at least 90% attendance during a two-month period.
- Scholarship approval requires theory and practical evaluation; never automatic.
- Level promotion from B1 to B2 requires attendance, consistency and theory/practice evaluation.
- Internal roles are controlled by the app, not by Google.

## Backlog
1. Auth/session and RBAC.
2. Branch/student/teacher/class management.
3. Student and teacher attendance.
4. Scholarship and promotion reports.
5. Landing page and enrollment request.
6. AWS deployment and evidence.

## Requirement-to-endpoint traceability
| Requirement | Endpoint |
|---|---|
| FR-02 | `POST /api/v1/auth/google`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout` |
| FR-03 | `/api/v1/branches`, `/api/v1/students`, `/api/v1/teachers`, `/api/v1/class-groups`, `/api/v1/class-sessions` |
| FR-04 | `POST /api/v1/student-attendance` |
| FR-05 | `POST /api/v1/teacher-attendance/check-in`, `PATCH /api/v1/teacher-attendance/{id}/check-out` |
| FR-07 | `GET /api/v1/reports/scholarships/{studentId}/candidate` |
| FR-09 | `GET /api/v1/reports/branches/summary`, `GET /api/v1/reports/teachers/{teacherId}/payment` |
| FR-10 | `GET /api/v1/audit-logs` |
