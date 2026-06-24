# Test Plan

## Scope
- Unit tests for attendance rules, scholarship eligibility, promotion eligibility and teacher payment.
- Integration tests for auth/session, RBAC and academic workflows.
- Security behavior tests for logout, expired sessions and private no-store/redirect behavior.

## Test Cases
| Area | Case | Expected Result |
|---|---|---|
| Auth | Login with mock Google token in test mode | User and session cookie returned. |
| Auth | Logout | Session is revoked and `/auth/me` returns 401. |
| Auth | Invalid token | Login returns 401. |
| Auth | Expired session | `/auth/me` returns 401. |
| Browser cache | Private page without session | `Cache-Control: no-store` and redirect to landing. |
| Browser cache | Private dashboard with valid session | Returns protected dashboard. |
| RBAC | Student accesses consolidated reports | Returns 403. |
| Attendance | Duplicate student/session record | Returns 409. |
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
Tests:       13 passed, 13 total
```
