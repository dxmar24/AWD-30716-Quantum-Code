# Executable project structure

`06Code` contains the complete deployable system. The folders are organized by responsibility while preserving the existing runtime contracts.

| Folder | Responsibility |
| --- | --- |
| `frontend/` | React/Vite user interface, public assets and presentation components. |
| `backend/src/` | Node.js/Express transactional API, authentication, business rules and reports. |
| `backend/tests/` | Jest unit, integration, security and actor-flow tests. |
| `apis/python-analytics-api/` | Independent FastAPI analytics service and its tests. |
| `persistence/prisma/` | Prisma application mapping for PostgreSQL. |
| `persistence/migrations/` | Ordered, versioned SQL migrations; source of truth for schema changes. |
| `persistence/seeders/` | Controlled SQL seed data for approved environments. |
| `scripts/` | Build, migration, validation, evidence and deployment support commands. |
| `dist/` | Generated frontend build output; never edit it manually. |

The files `package.json`, `Dockerfile`, `docker-compose.yml` and `vite.config.js` remain at this level because they orchestrate more than one folder. The Node backend is still one deployable application. This reorganization does not claim that its internal route groups are physically independent microservices.

## Local verification

Run these commands from `06Code`:

```powershell
npm ci
npm run db:generate
npm test
npm run frontend:build
npm run test:api:validation
npm run postman:coverage
```

For the Python analytics service:

```powershell
cd apis/python-analytics-api
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Production schema changes must use `npm run db:migrate`. Do not replace the migration workflow with `prisma db push`.
