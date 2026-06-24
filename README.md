# American Latin Class Attendance System

Academic-professional web project for Advanced Web Development. The executable project is in `06Code`; definition, requirements, documentation, UML, tests and auxiliary evidence are organized in the required numbered folders.

## Run
```bash
cd 06Code
npm install
npm test
npm start
```

Open `http://localhost:3000`.

## Runtime Modes
- Tests and local demo use in-memory repositories.
- Production uses PostgreSQL through Prisma ORM with `DB_DRIVER=prisma` and `DATABASE_URL`.
- Google OAuth is verified with Google in production. Mock tokens are only allowed in test/development when explicitly enabled.

## Stack
- Backend framework: Express.js on Node.js.
- Frontend framework decision: React + Vite for the next UI phase. The current executable UI is a static compatibility shell.
- ORM: Prisma ORM with PostgreSQL.

## Main API
All backend endpoints use `/api/v1`, including auth/session, users/roles, branches, students, teachers, dance styles, class groups, attendance, teacher check-in/out, absence justifications, scholarship evaluations, level promotion evaluations, reports and audit logs.

## Current Test Evidence
The automated suite covers 4 test suites and 13 tests:
- Auth/session
- RBAC
- Business rules
- Academic integrations
