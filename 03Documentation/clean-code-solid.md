# Clean Code And SOLID Decisions

## Clean Code
- English names are used in code.
- Controllers keep HTTP concerns and delegate business rules to services.
- Validation is centralized under `src/validators`.
- Response format is centralized in `ApiResponse`.
- Errors use `AppError` plus centralized `errorHandler`.
- Repositories isolate data access and allow in-memory tests or Prisma ORM production runtime.

## SOLID
- Single Responsibility: `AuthService`, `AttendanceService`, `RulesService`, `AcademicService` and `AuditService` each own a focused domain concern.
- Open/Closed: new persistence drivers can be added through repository classes without changing controllers.
- Liskov Substitution: in-memory, Prisma and legacy PostgreSQL repositories expose the same `all`, `findById`, `findBy`, `create`, `update` contract.
- Interface Segregation: controllers receive only the services/repositories they need through dependency construction in `app.js`.
- Dependency Inversion: services depend on repository behavior, not on Express or PostgreSQL directly.

## KISS And DRY
- CRUD endpoints reuse `CrudController` and route registration helpers.
- Domain commands stay explicit where business language matters, such as check-in/check-out and evaluation registration.
- The project avoids premature microservice code splitting while documenting AWS service separation for deployment.
