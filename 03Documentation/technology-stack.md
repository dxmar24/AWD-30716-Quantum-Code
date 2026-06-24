# Technology Stack Decision

## Backend Framework
Selected framework: **Express.js on Node.js**.

Reason:
- Fits the existing backend-first academic project.
- Supports clean REST APIs, middleware, validation, controllers, services and tests.
- Keeps the codebase understandable for Advanced Web Development review.

## Frontend Framework
Selected and implemented framework: **React + Vite**.

Reason:
- React is widely accepted for academic and professional web applications.
- Vite gives a simple, fast frontend build pipeline.
- The landing page and private dashboard are implemented as React components under `06Code/frontend`.

Implemented frontend components:
- `LandingPage`
- `EnrollmentForm`
- `PrivateDashboard`
- `AttendanceWorkflow`
- `TeacherCheckInWorkflow`
- `ReportsPanel`
- API client module using `fetch` with credentials.

## ORM
Selected ORM: **Prisma ORM**.

Reason:
- Strong PostgreSQL support.
- Schema is explicit and easy to review academically.
- Generated client reduces raw SQL/data mapping mistakes.
- Works well with service/repository architecture.

Current implementation status:
- `06Code/prisma/schema.prisma` defines the normalized PostgreSQL data model.
- `PrismaDatabaseContext` and `PrismaRepository` wire Prisma into the repository layer.
- `DB_DRIVER=prisma` is now the production/default database driver when `DATABASE_URL` exists.
- In-memory repositories remain for fast unit/integration tests.

Legacy note:
- The previous raw `pg` repository remains as fallback with `DB_DRIVER=pg`, but the required production ORM path is Prisma.

## Implemented React + Vite Frontend
The frontend migration is now implemented under `06Code/frontend` with React components for the public landing page and private dashboard workflows. Vite builds the browser application into `06Code/dist/frontend` using `npm run frontend:build`.

Implemented components:
- `LandingPage`, `EnrollmentForm`, `BranchSummary`, and `StylesLevels` for the public enrollment experience.
- `PrivateDashboard`, `AttendanceWorkflow`, `TeacherCheckInWorkflow`, `ReportsPanel`, `AuthStatus`, and `LogoutButton` for authenticated operations.

Deployment note:
- Express serves `06Code/dist/frontend` first. The private dashboard route is handled by the React app, and legacy `/public/private` files are not used.
- The hero asset is available through the Vite public assets folder and is included in the frontend build.
- AWS EC2 deployments should run `npm run frontend:build` before `npm start`; Nginx may also serve `06Code/dist/frontend` directly while proxying `/api/v1` to Express.
