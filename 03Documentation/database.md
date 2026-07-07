# Database Documentation

Production uses normalized PostgreSQL with Prisma ORM as the required application data-access layer. The SQL schema is in `06Code/migrations/001_initial_schema.sql`, seed data is in `06Code/seeders/001_seed.sql`, and the ORM schema is in `06Code/prisma/schema.prisma`.

The SQL schema and Prisma schema are kept aligned for the academic model, including the `level_promotion_evaluations.evaluated_by` user relation and `evaluated_at` timestamp.

## Main Tables
| Table | Purpose |
|---|---|
| `branches` | Academy branches: Norte, Matriz, Sur Guamani, Tumbaco, Conocoto. |
| `roles`, `permissions`, `role_permissions` | Internal role/permission catalog controlled by the app. |
| `users` | Internal academy accounts with email username, optional Google link, password hash, role reference and first-login password-change state. |
| `user_branch_access` | Explicit branch assignments for branch-scoped directors and reporting access. |
| `students` | Student academic profile, branch and level B1/B2. |
| `teachers` | Teacher profile, branch and hourly rate. |
| `dance_categories`, `dance_styles`, `teacher_styles` | Dance catalog and teacher-style assignments. |
| `class_groups`, `class_sessions` | Academic groups and scheduled sessions. |
| `student_attendance_records` | Student attendance by session with unique student/session rule. |
| `teacher_attendance_records` | Teacher check-in/check-out records for hours and payment. |
| `absence_justifications` | Student/teacher absence review workflow. |
| `scholarship_rules`, `scholarship_evaluations` | Scholarship threshold and director evaluation records. |
| `level_promotion_evaluations` | B1 to B2 evaluation evidence. |
| `enrollment_requests` | Public landing enrollment requests. |
| `sessions` | Server-side session hashes, expiration and revocation. |
| `audit_logs` | Traceability for administrative and academic actions. |

## Normalization Notes
- User identity is separated from student/teacher academic profiles.
- User credentials are stored as one-way password hashes; public API responses never include `password_hash`.
- `users.must_change_password` forces first-login users to update temporary credentials before protected academic flows.
- `users.password_changed_at` records the latest successful password change.
- Roles and permissions are normalized instead of hardcoding permissions in user rows.
- Branch-scoped authorization is normalized through `user_branch_access` so a BranchDirector can be assigned to one or more branches without changing the user identity model.
- Dance categories and styles avoid repeated text inside class groups.
- Attendance records reference class sessions and students/teachers.
- Scholarship and level promotion approvals store evaluation evidence separately from candidate calculation.

## Integrity Rules
- `student_attendance_records` has `UNIQUE(student_id, class_session_id)`.
- Level values are constrained to `B1` and `B2`.
- Attendance status is constrained to `present`, `absent`, `justified`, `late`.
- Scholarship percentage is constrained to `25`, `50`, `75`, `100`.
- Session tokens are stored as hashes.
- Temporary role-test and onboarding passwords should be rotated, changed by the user or removed before production handoff.

## ORM Runtime Selection
- `NODE_ENV=test` uses in-memory repositories for fast automated tests.
- `DB_DRIVER=prisma` and `DATABASE_URL` enable Prisma ORM repositories in production/deployment.
- `DB_DRIVER=pg` is retained only as a legacy fallback for the previous raw PostgreSQL repository.

## Prisma Commands
```bash
cd 06Code
npm run db:local:up
npm run db:generate
npm run db:push
npm run db:seed:role-test
```

The local Docker database uses `postgres://alc_user:change_me@localhost:5432/american_latin_class`, matching `06Code/.env.example`. Use stronger credentials outside local development.

## Existing Database Upgrade
Existing deployments should apply `06Code/migrations/002_account_login_policy.sql` to add:
- `users.must_change_password`
- `users.password_changed_at`
