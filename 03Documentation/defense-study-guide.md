# American Latin Class Defense Study Guide

## 1. Product In One Minute

American Latin Class is a dance-academy management system, not a technical demo and not only an attendance application. The public experience attracts and enrolls future students. The private experience manages accounts, branches, students, teachers, dance groups, schedules, attendance, absences, events, payments, scholarships, promotions, reports and auditing.

The six actors are Visitor, Student, Teacher, Branch Director, General Director and Administrator. Authorization is both role-based and resource-scoped: a role grants a workflow, while branch, teacher or student ownership limits the actual records.

## 2. Architecture

```text
React + Vite
     |
Express REST API ---- FastAPI analytics
     |                       |
     +------ PostgreSQL -----+
```

- React presents the public academy and private role-specific workspace.
- Express owns authentication, sessions and transactional academic workflows.
- Controllers handle HTTP, services enforce business rules, repositories isolate persistence, validators reject malformed input and middleware handles security, cache and errors.
- Prisma maps the normalized PostgreSQL schema. Versioned SQL migrations remain the schema source of truth.
- FastAPI reads the same PostgreSQL data and validates the same revocable Node session token for scoped analytics.

Show `03Documentation/architecture.md`, `06Code/backend/src/server.js`, `06Code/backend/src/routes/api.js`, `06Code/persistence/prisma/schema.prisma` and `06Code/apis/python-analytics-api/app/main.py`.

## 3. Recommended Live Demo

### Visitor

1. Open the landing page and show the academy-first message, rotating hero, programs and five branches.
2. Scroll away from the hero and explain that its timer pauses when it is not visible.
3. Submit or explain the enrollment request with server-side validation and rate limiting.

### General Director

1. Sign in and show the light workspace with fixed collapsible navigation.
2. Open Reportes and compare all branches with one branch.
3. Filter the general report by date, level and payment status.
4. Open Asistencia detallada and filter by branch, student, class group, level, status and name.
5. Export CSV and open Imprimir / PDF.
6. Show financial totals, active/retired students, debt, attendance and event income.

### Branch Director

1. Show that only assigned branches are visible.
2. Manage students, teachers, groups, sessions, attendance, enrollment prospects and academy events.
3. Attempting another branch is rejected by `AccessPolicy`, not merely hidden in the UI.

### Teacher

1. Show upcoming assigned classes.
2. Open a roster, save a draft and finalize attendance.
3. Explain exact roster validation, duplicate prevention and controlled correction after finalization.

### Student

1. Show next class, attendance indicator, group, payment status and B1/B2 events.
2. Upload, replace and remove the profile photo.
3. Submit an absence justification only for the student's own record.

### Administrator

1. Show account governance, roles, active state, branch access, email invitation/reset, security and audit history. Create or resend an invitation, show only the delivery confirmation in the panel, and open Mailpit to prove that the temporary password reached the recipient without appearing in the API response.
2. Explain that academic and financial decisions remain visible but are separated from account administration by permissions and audit logs.

Detailed alternatives for every actor are in `03Documentation/actor-flows/`.

## 4. Business Rules Worth Defending

- Director-created accounts receive a branded email and require a password change before academic access. The temporary credential never appears in the director dashboard or API response.
- Google sign-in links only an existing active account with the same verified email; it never self-registers a private role.
- Students and groups must share branch and level. Capacity overflow becomes a waitlist.
- Sessions cannot overlap for the same teacher or group and cannot exceed six hours.
- Final attendance requires the complete historical roster. Corrections require authority and a reason.
- An approved excuse does not rewrite an absence as presence; it is excluded only from the adjusted denominator.
- Paid accounting entries are immutable. Corrections use linked negative reversals.
- Reports only include authorized, coherent data for the selected cutoff date.

## 5. Reports

Routes are declared in `06Code/backend/src/routes/api.js:233-239`; orchestration is in `06Code/backend/src/controllers/ReportsController.js`; formulas are in `06Code/backend/src/functional/reportMetrics.js`; UI and export are in `06Code/frontend/src/components/reports/ReportsPanel.jsx`.

General reports include academic, attendance, financial, capacity, prospect, event and data-quality indicators. Attendance reports include totals and detail grouped by student, class and branch. Filters include date range, all/one branch, level, payment status, student, class group, attendance status and name search. Current views export to CSV or browser print/PDF.

## 6. Security, Validation And Cache

- Zod request schemas: `06Code/backend/src/validators/commonValidators.js`.
- Authentication and revocable hashed sessions: `src/services/AuthService.js` and `src/middleware/auth.js`.
- Role/resource scope: `src/services/AccessPolicy.js`.
- Rate limits, Helmet, CORS and no-store policies: `src/app.js`, middleware and `security-guide.md`.
- Cache: public health/configuration, private scoped catalog/report entries and no-store personal/session data. Tag invalidation prevents stale writes. Evidence headers include `X-Memory-Cache` and `X-Cache-Policy`.

Never expose `.env`, session tokens, database passwords or AWS private keys during the defense.

## 7. Requested Programming Concepts

Use `programming-paradigms-defense-guide.md`. The strongest story is one end-to-end report: asynchronous authorized I/O feeds pure functional calculations, and React reactively renders and exports the result. `scryptSync` is the explicit blocking counterexample.

## 8. Python Analytics

The service lives in `06Code/apis/python-analytics-api`. It does not duplicate login or transactional writes. It verifies the Node JWT plus the session hash in PostgreSQL, then applies the same resource scope before calculating attendance risk, scholarship readiness, branch performance or teacher workload.

Demonstrate it with the analytics Postman collection after the Node login request has saved `session_token`. Then log out through Node and prove that the old token is rejected by Python.

## 9. Evidence Snapshot

Verified locally on July 21, 2026:

- Node/Jest: 11 suites, 91 tests passed.
- HTTP validation: 134 of 134 checks passed.
- Main Postman collection: 105 requests and 135 assertions, no failures; all 86 Express route contracts are represented.
- Python analytics tests: 15 passed.
- Python Postman collection: 6 requests and 12 assertions, no failures.
- React production build: successful.

See `testing-guide.md`, `api-validation-report.md`, `postman/evidence/` and `07Other/visual-evidence/defense/`.

## 10. Questions To Expect

**Why two APIs?** Express owns secure transactional workflows; FastAPI is a separate analytics boundary required by the project and reuses identity and data instead of creating a second security model.

**Why not MongoDB?** Attendance, payments, enrollments, roles and auditing require strong relations, constraints and transactions. PostgreSQL fits those contracts better.

**Is JSDoc a runtime interface?** No. It documents the functional contract and helps the editor; automated tests verify actual behavior.

**Why are AWS instances stopped?** Cost control. The complete stack is verified locally with the same application code and PostgreSQL migrations; instances can be started only for the final deployment window.

**How is stale cache avoided?** Sensitive responses are never stored, scoped keys include actor/branch context, TTL limits lifetime, and write services invalidate data tags.

**What would you improve next?** Move CPU-heavy password derivation to asynchronous workers at greater scale, use Redis for multi-instance cache, add object storage for profile images and place APIs behind an HTTPS load balancer with private networking.

## Final Preparation

1. Run every command in `local-defense-runbook.md`.
2. Keep the five role sessions ready in separate browser profiles.
3. Import Postman collections and set only local current values.
4. Open the exact code files for reports, functional interfaces, validation, auth and Python.
5. Keep DBeaver connected to the local database.
6. Do not start AWS until an online URL is truly required.
