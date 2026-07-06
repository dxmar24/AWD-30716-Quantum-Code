# Test Plan

## Scope
- Unit tests for attendance rules, scholarship eligibility, promotion eligibility and teacher payment.
- Integration tests for auth/session, RBAC and academic workflows.
- Security behavior tests for logout, expired sessions and private no-store/redirect behavior.
- Resource-scope tests for BranchDirector branch assignment, Teacher self-check-in limits, seeded password-hash login and attendance windows based on class session date.

## Test Cases
| Area | Case | Expected Result |
|---|---|---|
| Auth | Login with mock Google token in test mode | User and session cookie returned. |
| Auth | Logout | Session is revoked and `/auth/me` returns 401. |
| Auth | Invalid token | Login returns 401. |
| Auth | Seeded password-hash login | Role-specific user logs in and `passwordHash` is not exposed. |
| Auth | Expired session | `/auth/me` returns 401. |
| Browser cache | Private page without session | `Cache-Control: no-store` and redirect to landing. |
| Browser cache | Private dashboard with valid session | Returns protected dashboard. |
| RBAC | Student accesses consolidated reports | Returns 403. |
| Scope | BranchDirector creates data in assigned branch | Returns 201. |
| Scope | BranchDirector creates data in unassigned branch | Returns 403. |
| Scope | BranchDirector branch summary | Returns only assigned branches. |
| Scope | Teacher check-in for own profile | Returns 201. |
| Scope | Teacher check-in for another profile | Returns 403. |
| Attendance | Duplicate student/session record | Returns 409. |
| Attendance | Attendance window uses class session date | Historical sessions outside the window are excluded. |
| Absence | Director reviews justification | Review status is updated. |
| Scholarship | Attendance >=90% plus scores | Evaluation can be registered. |
| Promotion | B1 candidate plus scores | Evaluation can promote to B2. |
| Payment | Checked-out teacher hours | Amount equals hours times hourly rate. |

## Execution
```bash
cd 06Code
npm test
```

Expected evidence:
```text
Test Suites: 4 passed, 4 total
Tests:       20 passed, 20 total
```
