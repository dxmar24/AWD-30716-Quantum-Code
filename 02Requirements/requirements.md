# Requirements

## Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---:|---|
| FR-01 | Public landing page shows academy information, branches, styles, levels, contact/enrollment request. | High | Visitor can open `/`, read branches/styles/levels and submit an enrollment request. |
| FR-02 | Google OAuth registration/login with internal roles plus controlled manual role login. | High | Backend verifies Google ID token in production, links `google_sub`, creates app session, supports hashed role-test passwords for manual verification and never trusts Google for app roles. |
| FR-03 | Secure session management. | High | Session cookie is HttpOnly/SameSite, logout revokes server session, expired sessions return 401, private pages redirect after logout/back button. |
| FR-04 | Role-based and resource-scoped authorization. | High | Student/Teacher/BranchDirector/GeneralDirector/Admin access is enforced by middleware and resource-scope policy; BranchDirector access is limited to assigned branches. |
| FR-05 | Branch, student, teacher, class group and class session management. | High | Directors/Admin can create/update core academic data; authenticated users can list/read. |
| FR-06 | Dance category/style management. | Medium | Urban, Tropical and Ethnic styles are seeded and manageable through API. |
| FR-07 | Student attendance. | High | Teacher/director records one attendance status per student and class session. Duplicates are rejected. |
| FR-08 | Teacher check-in/check-out. | High | Teacher/director opens one active check-in and later closes it for hour calculation. |
| FR-09 | Absence justifications. | Medium | Authorized users submit a justification and directors approve/reject it. |
| FR-10 | Scholarship eligibility and evaluation. | High | System marks candidates at >=90% attendance over two months; directors register theory/practice results and approval decision. |
| FR-11 | Level promotion eligibility and evaluation. | High | B1 students can be marked as B2 candidates based on attendance and directors register consistency/theory/practice results. |
| FR-12 | Teacher worked hours and payment report. | Medium | Completed check-in/out records produce hours, hourly rate and amount. |
| FR-13 | Branch and consolidated reports. | Medium | GeneralDirector/Admin can view branch summaries and restricted reports. |
| FR-14 | Audit logs. | Medium | Administrative and attendance actions are recorded and visible to GeneralDirector/Admin. |

## Non-Functional Requirements
| ID | Requirement | Evidence |
|---|---|---|
| NFR-01 | REST API versioned with `/api/v1`. | `06Code/src/routes/api.js` |
| NFR-02 | Clean Code, MVC, services and repositories. | Controllers delegate to services; persistence is isolated by repository classes. |
| NFR-03 | PostgreSQL normalized schema and seeders. | `06Code/migrations/001_initial_schema.sql`, `06Code/seeders/001_seed.sql`, `06Code/scripts/seed-role-test-data.js` |
| NFR-04 | No production secrets in repository. | `.env.example` contains placeholders plus clearly temporary local seed defaults that must be rotated/removed before production. |
| NFR-05 | Restricted CORS. | `CORS_ORIGINS` env configuration. |
| NFR-06 | Auth rate limiting. | `express-rate-limit` on `/auth/google`. |
| NFR-07 | Consistent JSON responses. | `ApiResponse` success/error envelope. |
| NFR-08 | Centralized validation. | Zod validators under `src/validators`. |
| NFR-09 | Consistent error handling. | `AppError` and `errorHandler` middleware. |
| NFR-10 | AWS deployment preparation. | EC2/RDS/ALB guide and PlantUML deployment diagram. |
| NFR-11 | Production-safe configuration. | Production/staging fails fast on default secrets, missing database URL or enabled mock Google tokens. |

## User Stories
| ID | Story |
|---|---|
| US-01 | As a Visitor, I want to request enrollment from the public page so the academy can contact me. |
| US-02 | As a Student, I want secure access to my private academic system session. |
| US-03 | As a Teacher, I want to record student attendance and check in/out for my worked hours. |
| US-04 | As a BranchDirector, I want to manage students, teachers, classes and absence justifications for my branch. |
| US-05 | As a BranchDirector, I want to review scholarship and promotion candidates before registering evaluations. |
| US-06 | As a GeneralDirector, I want consolidated branch reports and audit logs. |
| US-07 | As an Admin, I want to assign internal roles, branch access and role-test users without depending on Google profile data. |

## Role/Permission Matrix
| Feature | Visitor | Student | Teacher | BranchDirector | GeneralDirector | Admin |
|---|---:|---:|---:|---:|---:|---:|
| View landing page | X | X | X | X | X | X |
| Submit enrollment request | X |  |  |  |  |  |
| Login/logout/session |  | X | X | X | X | X |
| List own/private data |  | X | X | X | X | X |
| Record student attendance |  |  | X | X | X | X |
| Teacher check-in/out |  |  | X | X | X | X |
| Submit absence justification |  | X | X | X | X | X |
| Review absence justification |  |  |  | X | X | X |
| Manage academic data |  |  |  | X | X | X |
| Scholarship/promotion evaluation |  |  |  | X | X | X |
| Branch reports |  |  |  | X | X | X |
| Consolidated reports |  |  |  |  | X | X |
| Audit logs |  |  |  |  | X | X |
| Assign roles |  |  |  |  |  | X |
| Assign branch access |  |  |  |  |  | X |
| Use temporary seeded role login |  | X | X | X | X | X |

## Business Rules
- BR-01: Scholarship candidate requires at least 90% attendance in a two-month period.
- BR-02: Scholarship approval is never automatic; directors must register theory and practice evaluation results.
- BR-03: Scholarship percentages allowed are 25%, 50%, 75% and 100%.
- BR-04: Level promotion applies to B1 students moving to B2.
- BR-05: Level promotion approval requires attendance evidence, consistency score, theory score and practice score.
- BR-06: A student can have only one attendance record per class session.
- BR-07: A teacher can have only one open check-in at a time.
- BR-08: Roles are owned by the application and are not inferred from Google claims.
- BR-09: BranchDirector permissions require explicit branch assignment and must not expose other branches.
- BR-10: Student and Teacher users can only access their own academic/profile records and teaching context.
- BR-11: Private pages and APIs must use `Cache-Control: no-store`.
- BR-12: Administrative and academic state-changing actions must be audited.
- BR-13: Manual role-test credentials must be stored as password hashes and remain disabled unless `POSTMAN_LOGIN_ENABLED=true`.

## Prioritized Backlog
1. Auth/session, RBAC, no-store private pages and tests.
2. PostgreSQL schema, seeders and repository abstraction.
3. Branch/student/teacher/style/class management APIs.
4. Student attendance and teacher check-in/check-out APIs.
5. Absence justifications and audit logs.
6. Scholarship and level promotion candidate/evaluation workflows.
7. Reports by branch, teachers and consolidated roles.
8. Landing page, enrollment form and private dashboard shell.
9. AWS EC2/RDS/ALB deployment documentation and diagrams.
10. Final test evidence and requirement reevaluation.

## Requirement-To-Endpoint Traceability
| Requirement | Endpoints |
|---|---|
| FR-01 | `GET /`, `POST /api/v1/enrollment-requests` |
| FR-02 | `POST /api/v1/auth/google`, `POST /api/v1/auth/login`, `GET /api/v1/users`, `PATCH /api/v1/users/{id}/role` |
| FR-03 | `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`, `/private/dashboard.html` |
| FR-04 | All protected endpoints through `requireAuth`/`allowRoles` |
| FR-05 | `/api/v1/branches`, `/api/v1/students`, `/api/v1/teachers`, `/api/v1/class-groups`, `/api/v1/class-sessions` |
| FR-06 | `/api/v1/dance-categories`, `/api/v1/dance-styles` |
| FR-07 | `POST /api/v1/student-attendance` |
| FR-08 | `POST /api/v1/teacher-attendance/check-in`, `PATCH /api/v1/teacher-attendance/{id}/check-out` |
| FR-09 | `/api/v1/absence-justifications`, `/api/v1/absence-justifications/{id}/review` |
| FR-10 | `GET /api/v1/reports/scholarships/{studentId}/candidate`, `/api/v1/scholarship-evaluations` |
| FR-11 | `GET /api/v1/reports/level-promotions/{studentId}/candidate`, `/api/v1/level-promotion-evaluations` |
| FR-12 | `GET /api/v1/reports/teachers/{teacherId}/payment` |
| FR-13 | `GET /api/v1/reports/branches/summary` |
| FR-14 | `GET /api/v1/audit-logs` |
