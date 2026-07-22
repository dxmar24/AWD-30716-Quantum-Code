# Documentation Index

This directory is the authoritative documentation map for the American Latin Class Academy Management System. Start here instead of opening files at random during the defense.

## Defense Entry Points

| Need | Document |
| --- | --- |
| Complete oral and live-demo sequence | `defense-study-guide.md` |
| Start every service locally | `local-defense-runbook.md` |
| Functional interfaces, lambdas, reactive, blocking and non-blocking evidence | `programming-paradigms-defense-guide.md` |
| Automated test commands and current results | `testing-guide.md` |
| Postman collections and execution order | `../postman/README.md` |

## Architecture And Implementation

| Area | Source of truth |
| --- | --- |
| System layers and deployment model | `architecture.md` |
| Complete UML and architecture diagrams | `../04UMLDiagrams/README.md` |
| Diagram consistency and rendering evidence | `diagram-validation-report.md` |
| Technology choices | `technology-stack.md` |
| REST resources and contracts | `api-documentation.md` |
| URI conventions | `uri-design.md` |
| PostgreSQL model and migrations | `database.md` |
| Authentication, first login and Google linking | `authentication-flows.md` and `oauth-session.md` |
| Branded account invitation email | `account-invitation-email.md` |
| Security and authorization | `security-guide.md` |
| Cache strategy and evidence | `cache-management.md` |
| Python analytics service | `python-analytics-api.md` |
| Functional report layer | `functional-programming-report-layer.md` |
| Frontend media sources and UX rules | `frontend-visual-assets.md` |

## Product And User Flows

The six actor documents under `actor-flows/` describe the normal path, alternatives, permissions and expected results for Visitor, Student, Teacher, Branch Director, General Director and Administrator.

Product requirements and traceability are maintained in `../02Requirements/requirements.md`, `product-backlog-validation.md`, and `client-director-program-review.md`.

## Operations

| Area | Document |
| --- | --- |
| Local demo data and database access | `demo-data-and-database-visual-access.md` |
| Private cloud database inspection | `cloud-database-viewer.md` |
| AWS deployment | `aws-deployment-guide.md` |
| Current AWS staging deployment | `aws-current-deployment.md` |
| Hardening and business rules | `system-hardening-and-business-rules.md` |

## Evidence Locations

- API validation: `api-validation-report.md` and `../07Other/api-validation-results.json`.
- Node Postman evidence: `../postman/evidence/postman-local-jwt-auth-evidence.md`.
- Python Postman evidence: `../postman/evidence/python-analytics-api-evidence.md`.
- UI captures by actor: `../07Other/visual-evidence/defense/`.
- Unit and integration tests: `../06Code/backend/tests/`.

The AWS staging deployment was verified on July 22, 2026. Because public EC2 addresses can change after a stop/start cycle, consult `aws-current-deployment.md` before a live defense. The same Node, React, PostgreSQL and FastAPI code can also run locally.
