# Database Documentation

Production uses normalized PostgreSQL with Prisma ORM as the required application data-access layer. The SQL schema is in `06Code/migrations/001_initial_schema.sql`, seed data is in `06Code/seeders/001_seed.sql`, and the ORM schema is in `06Code/prisma/schema.prisma`.

## Main Tables
| Table | Purpose |
|---|---|
| `branches` | Academy branches: Norte, Matriz, Sur Guamani, Tumbaco, Conocoto. |
| `roles`, `permissions`, `role_permissions` | Internal role/permission catalog controlled by the app. |
| `users` | Google-linked application users with internal role reference. |
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
- Roles and permissions are normalized instead of hardcoding permissions in user rows.
- Dance categories and styles avoid repeated text inside class groups.
- Attendance records reference class sessions and students/teachers.
- Scholarship and level promotion approvals store evaluation evidence separately from candidate calculation.

## Integrity Rules
- `student_attendance_records` has `UNIQUE(student_id, class_session_id)`.
- Level values are constrained to `B1` and `B2`.
- Attendance status is constrained to `present`, `absent`, `justified`, `late`.
- Scholarship percentage is constrained to `25`, `50`, `75`, `100`.
- Session tokens are stored as hashes.

## ORM Runtime Selection
- `NODE_ENV=test` uses in-memory repositories for fast automated tests.
- `DB_DRIVER=prisma` and `DATABASE_URL` enable Prisma ORM repositories in production/deployment.
- `DB_DRIVER=pg` is retained only as a legacy fallback for the previous raw PostgreSQL repository.

## Prisma Commands
```bash
cd 06Code
npm run db:generate
npm run db:push
```
