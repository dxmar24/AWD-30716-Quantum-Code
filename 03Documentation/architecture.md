# Architecture Documentation

## Selected stack and justification
Node.js with Express is used for a small, clear academic backend that supports REST, middleware, validation, testing and modular OOP service classes. PostgreSQL is documented as the production database because it supports normalized relational academic data and AWS RDS deployment.

## Backend architecture
Controllers only parse HTTP concerns and delegate to services. Services implement business rules. Repositories isolate persistence. Validators centralize request validation. Middleware handles sessions, authorization, cache control, CORS and errors.

## URI conventions
All private APIs use `/api/v1`, plural nouns, JSON request/response bodies and consistent envelopes: `{ success, message, data }` or `{ success:false, message, details }`.

## OAuth/session strategy
The backend verifies Google ID tokens, links `google_sub` to an internal user and issues an application session through HttpOnly Secure SameSite cookies. Logout revokes the server-side session. Private pages use `Cache-Control: no-store` to prevent browser back-button access after logout.

## AWS deployment
- Frontend EC2: Nginx on ports 80/443 serving static landing/app assets.
- Core Business API EC2: port 3000 for branches, students, teachers, classes and attendance.
- Auth & Session API EC2: port 3001 for OAuth, sessions, roles and permissions.
- Reports & Rules API EC2: port 3002 for scholarship, promotion, hours and payments.
- PostgreSQL: Amazon RDS private subnet on port 5432.
Security groups should allow public 443 only to ALB/Nginx, API traffic only from frontend/ALB, and RDS only from API security groups. HTTPS with ACM certificates and an optional ALB is recommended.

## Environment variables
See `06Code/.env.example` for required runtime variables.

## Clean Code and SOLID decisions
Business rules live in services, HTTP details live in controllers, cross-cutting concerns live in middleware, and constants avoid magic strings. Classes depend on abstractions supplied through constructors.
