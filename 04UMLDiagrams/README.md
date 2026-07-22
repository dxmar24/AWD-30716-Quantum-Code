# American Latin Class Diagram Package

This folder contains the diagram sources that match the executable system under `06Code`. The generated SVG, PNG and PDF files are stored in `../08PDFDeliverables/04UMLDiagrams`.

## Recommended Defense Order

| Order | Diagram | What to explain |
| ---: | --- | --- |
| 1 | `system-context.puml` | Who uses the platform and which external systems participate. |
| 2 | `use-case-overview.puml` | Clean actor/capability summary suitable for one presentation slide. |
| 3 | `use-case.puml` | Complete actor coverage, mandatory `include` behavior and conditional `extend` flows. |
| 4 | `system-architecture.puml` | End-to-end layers: React, Nginx, Express, FastAPI, PostgreSQL, cache, email and security. |
| 5 | `component-diagram.puml` | Executable modules and dependencies inside each application. |
| 6 | `class-diagram.puml` | Controllers, services, repositories, attributes, methods, interfaces and real inheritance. |
| 7 | `domain-class-diagram.puml` | Complete persisted domain with attributes, cardinalities and key business constraints. |
| 8 | `entity-relationship.mmd` | PostgreSQL tables, PK/FK/unique fields and database relationships. |
| 9 | `aws-deployment.puml` | Current AWS topology, ports, reverse proxy, RDS and staging email capture. |
| 10 | `oauth-sequence.puml` | Password/Google login alternatives, secure cookies and mandatory first password change. |
| 11 | `account-invitation-sequence.puml` | Secure user provisioning and branded email without exposing the temporary password. |
| 12 | `attendance-sequence.puml` | Roster authorization, transactional batch attendance, finalization and correction. |
| 13 | `reports-sequence.puml` | Filters, actor-scoped cache, functional pipelines and CSV/PDF export. |
| 14 | `enrollment-activity.puml` | Visitor request through trial, account invitation and active/waitlisted enrollment. |
| 15 | `enrollment-state.puml` | Valid enrollment state transitions and guarded deletion rule. |
| 16 | `payment-state.puml` | Financial lifecycle and reversal instead of hard deletion. |

## Source Of Truth Checks

- Application classes and methods were derived from `06Code/backend/src/controllers`, `services` and `repositories`.
- Python analytical classes were derived from `06Code/apis/python-analytics-api/app`.
- Domain attributes and cardinalities were derived from `06Code/persistence/prisma/schema.prisma`.
- Endpoints and role boundaries were checked against `06Code/backend/src/routes/api.js`.
- Frontend modules were checked against `06Code/frontend/src/main.jsx` and `frontend/src/components`.
- Deployment nodes and ports match `03Documentation/aws-current-deployment.md` and `aws-deployment-guide.md`.

The three AWS Node instances run the same Express application. Nginx routes groups of endpoints to different instances for staging, but the diagrams do not represent them as independently coded microservices.

## Diagram Notation

- Solid arrows represent direct calls or associations.
- Dashed realization arrows represent a class implementing a structural interface/port.
- Hollow triangle arrows represent inheritance or actor specialization.
- `{PK}`, `{FK}` and `{unique}` document persistence constraints.
- UML `include` means mandatory reused behavior; `extend` means conditional or alternative behavior.

## Regenerate The Deliverables

From `06Code`, run:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
npm run diagrams:render
```

The renderer validates every PlantUML source and regenerates SVG, PNG and PDF files. SVG is preferred for projection because it remains sharp when zoomed. The Mermaid ERD is rendered separately with Mermaid CLI and is also natively viewable on GitHub.

## Quick Oral Explanation

1. The public landing page promotes the dance academy and accepts enrollment requests.
2. React provides a role-specific private dashboard for students, teachers and directors.
3. Nginx terminates HTTPS, serves static assets and routes the two API prefixes.
4. Express owns transactional workflows; controllers delegate to services, policies and repository ports.
5. PostgreSQL is the source of truth and every sensitive mutation creates an audit record.
6. FastAPI provides protected read-only analytics using the same session and branch scope.
7. The in-process cache accelerates safe repeated reads and is invalidated after mutations.
8. Invitations are delivered by email; temporary passwords are never shown to the director.
