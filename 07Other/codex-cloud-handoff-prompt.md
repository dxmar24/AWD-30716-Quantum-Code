# Codex Cloud Continuation Prompt

Use this prompt in Codex Cloud from the GitHub repository `dxmar24/AWD-30716-Quantum-Code` if another follow-up pass is needed.

```text
You are continuing an academic-professional Advanced Web Development project named "American Latin Class Attendance System".

Repository state:
- Required academic folders exist: 01Definition, 02Requirements, 03Documentation, 04UMLDiagrams, 05UnitTests, 06Code, 07Other.
- Backend framework is Node.js + Express.
- Frontend framework is React + Vite under 06Code/frontend.
- ORM is Prisma with PostgreSQL:
  - 06Code/prisma/schema.prisma
  - 06Code/src/repositories/PrismaRepository.js
  - 06Code/src/repositories/PrismaDatabaseContext.js
  - DB_DRIVER=prisma in .env.example
- In-memory repositories remain for automated tests.
- Legacy raw pg repositories remain only as fallback with DB_DRIVER=pg; Prisma is the required production path.
- React private dashboard routing has been corrected so /private/dashboard.html returns the React app, not legacy public/private files.
- SQL and Prisma schemas are aligned for level promotion evaluation auditing, including evaluated_by and evaluated_at.

Current validation evidence:
- npm run db:generate passes.
- npm run frontend:build passes.
- npm test passes:
  Test Suites: 4 passed, 4 total
  Tests: 13 passed, 13 total
- npm run db:smoke:prisma skips when DATABASE_URL is not set and should run against PostgreSQL when a real database is available.

Possible future hardening:
1. Run Prisma against a live PostgreSQL database:
   - Set DATABASE_URL.
   - Run npm run db:push or npm run db:migrate.
   - Run npm run db:smoke:prisma.
2. Add a PostgreSQL-backed integration test job if the environment provides a test database.
3. Improve React UX with real Google Sign-In client integration.
4. Split React components into separate files if the course reviewer values frontend organization.
5. Keep AWS documentation EC2/RDS oriented. Do not use Render or Netlify.

Constraints:
- Do not commit node_modules or dist build output.
- Keep English names in code.
- Keep API prefix /api/v1.
- Keep controllers free of business logic.
- Do not remove academic documentation folders.
```
