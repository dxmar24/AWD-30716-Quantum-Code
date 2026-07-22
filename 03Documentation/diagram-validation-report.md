# Diagram Validation Report

Validation date: July 22, 2026.

## Scope

The diagram package was rebuilt from the current React, Express, FastAPI, PostgreSQL and AWS deployment implementation. Old diagrams that represented controllers without attributes or independently coded Node microservices were replaced.

## Automated And Structural Results

| Check | Result |
| --- | ---: |
| PlantUML source files rendered without syntax errors | 15/15 |
| Mermaid ERD rendered without syntax errors | 1/1 |
| Prisma models represented in the ERD | 25/25 |
| Prisma models represented in the domain class diagram | 25/25 |
| Persisted scalar attributes represented in domain classes | All, 0 missing |
| Generated SVG files | 16 |
| Generated PNG files | 16 |
| Generated PDF files with valid `%PDF` signature | 16/16 |
| Obsolete duplicate PNG diagrams removed | 3 |

## Consistency Decisions

- The backend is represented as one modular Express application with controllers, services, policies and repository adapters.
- The AWS diagram shows three EC2 Node processes using the same Express build. Route-group proxying is deployment distribution, not independent source-code microservices.
- The analytical FastAPI application is shown separately because it has its own entry point, service and repository layer.
- PostgreSQL relationships and attributes match `06Code/persistence/prisma/schema.prisma`.
- Account invitations use branded email and never expose the temporary password to the director or API response.
- Enrollment deletion is conditional on the absence of attendance history.
- Financial corrections use linked reversals instead of hard deletion.
- Reports include financial and attendance categories, filters, actor-scoped cache, functional metric pipelines and CSV/PDF export.
- Use cases include all six actors and document mandatory `include` and conditional `extend` relationships.

## Visual Review

The context, use-case overview, AWS deployment, system architecture, application class, domain class and ERD PNG files were inspected after rendering. No syntax-error image, clipping or missing output was found. Large evidence diagrams are intentionally detailed; use their SVG or PDF version when zooming during the defense.

See `../04UMLDiagrams/README.md` for the recommended presentation order and oral explanation.

