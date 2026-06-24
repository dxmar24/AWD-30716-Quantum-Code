# Codex Cloud Handoff Prompt

Use this prompt in Codex Cloud from the GitHub repository `dxmar24/AWD-30716-Quantum-Code`.

```text
You are continuing an academic-professional Advanced Web Development project named "American Latin Class Attendance System".

Repository state:
- Required academic folders exist: 01Definition, 02Requirements, 03Documentation, 04UMLDiagrams, 05UnitTests, 06Code, 07Other.
- Backend is Node.js + Express.
- Frontend framework decision is React + Vite, but the current executable frontend is still a static HTML/CSS/vanilla JS compatibility shell under 06Code/public.
- ORM requirement is mandatory. Prisma ORM has been introduced:
  - 06Code/prisma/schema.prisma
  - 06Code/src/repositories/PrismaRepository.js
  - 06Code/src/repositories/PrismaDatabaseContext.js
  - DB_DRIVER=prisma in .env.example
- In-memory repositories remain for automated tests.
- Legacy raw pg repositories still exist as fallback with DB_DRIVER=pg, but Prisma is the required production path.
- Automated tests currently pass:
  Test Suites: 4 passed, 4 total
  Tests: 13 passed, 13 total

Primary goal:
Finish the mandatory frontend framework and ORM migration so the project can be reviewed as a serious Advanced Web Development submission.

Required work:
1. Frontend framework migration:
   - Create a React + Vite frontend inside 06Code, preferably under 06Code/frontend or 06Code/src/frontend.
   - Rebuild the current public landing page as React components:
     LandingPage, EnrollmentForm, BranchSummary, StylesLevels, PrivateDashboard.
   - Rebuild private dashboard workflows as React components:
     AttendanceWorkflow, TeacherCheckInWorkflow, ReportsPanel, AuthStatus, LogoutButton.
   - Keep the generated hero image at 06Code/public/assets/dance-hero.png or move it into the Vite public/assets structure.
   - Add frontend scripts such as frontend:dev and frontend:build.
   - Ensure Express can serve the built frontend or clearly document the Nginx/Vite build output path for AWS.

2. Prisma ORM hardening:
   - Run `npm run db:generate`.
   - Validate `prisma/schema.prisma` against PostgreSQL.
   - Prefer Prisma repositories for production runtime with DB_DRIVER=prisma.
   - If necessary, adjust Prisma model relation names and Decimal serialization.
   - Add a test or smoke script that can validate Prisma against a PostgreSQL test database when DATABASE_URL is available.
   - Consider removing or documenting the legacy raw pg repository as fallback only.

3. Database:
   - Verify SQL migration and Prisma schema match exactly.
   - If Prisma migrations are required, create an initial Prisma migration without losing the existing academic SQL migration evidence.
   - Keep seed data aligned with roles, permissions, branches, dance categories/styles and scholarship rules.

4. Documentation:
   - Update 03Documentation/technology-stack.md after React migration is implemented.
   - Update architecture/database/AWS docs if the frontend build location changes.
   - Update 07Other/final-compliance-review.md with the new final compliance status.

5. Validation:
   - Run `npm test`.
   - Run `npm run db:generate`.
   - If a local PostgreSQL database is available, run Prisma db push/migrate and a Prisma smoke test.
   - Provide final test evidence in the response.

Constraints:
- Do not commit node_modules.
- Keep English names in code.
- Keep API prefix /api/v1.
- Keep controllers free of business logic.
- Do not remove academic documentation folders.
- Do not use Render or Netlify; AWS deployment documentation must remain EC2/RDS oriented.
```
