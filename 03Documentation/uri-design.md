# URI Design

Base prefix: `/api/v1`

## Conventions
- Use plural nouns for resources: `/students`, `/teachers`, `/branches`.
- Use nested action segments only for domain commands that are not simple CRUD: `/teacher-attendance/check-in`, `/teacher-attendance/{id}/check-out`.
- Use reports under `/reports` because they are read-only projections.
- Use path parameters for identity: `/users/{id}/role`.
- Use query parameters for report filters: `?from=2026-01-01T00:00:00.000Z&to=2026-03-01T00:00:00.000Z`.
- Use JSON request/response bodies.
- Return consistent envelopes: `{ success, message, data }` and `{ success:false, message, details }`.

## Resource Areas
| Area | URI Pattern |
|---|---|
| Auth/session | `/auth/config`, `/auth/google`, `/auth/me`, `/auth/logout` |
| Users/roles | `/users`, `/users/{id}/role`, `/roles`, `/permissions` |
| Academic catalog | `/branches`, `/dance-categories`, `/dance-styles` |
| People | `/students`, `/teachers` |
| Scheduling | `/class-groups`, `/class-sessions` |
| Attendance | `/student-attendance`, `/teacher-attendance/check-in`, `/teacher-attendance/{id}/check-out` |
| Justifications | `/absence-justifications`, `/absence-justifications/{id}/review` |
| Evaluations | `/scholarship-evaluations`, `/level-promotion-evaluations` |
| Reports | `/reports/branches/summary`, `/reports/scholarships/{studentId}/candidate`, `/reports/level-promotions/{studentId}/candidate`, `/reports/teachers/{teacherId}/payment` |
| Audit | `/audit-logs` |
