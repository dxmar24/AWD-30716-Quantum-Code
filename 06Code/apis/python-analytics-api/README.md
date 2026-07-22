# American Latin Class Analytics API

Python FastAPI microservice for academic analytics in the American Latin Class Attendance System.

## Purpose

The Node.js API owns transactional workflows such as enrollment, attendance, roles and session creation. This Python API adds analytical views over the same PostgreSQL/RDS database:

- Student attendance risk.
- Scholarship readiness.
- Branch performance summaries.
- Teacher workload and estimated payment.

The service can reuse the same JWT session token issued by the Node Auth API. A user logs in through `POST /api/v1/auth/login` or Google auth, then sends the returned token as `Authorization: Bearer <token>` to the analytics endpoints. Protected analytics also enforce resource scope: students see their own records, teachers see their own workload and taught students, branch directors see assigned branches, and Admin/GeneralDirector see global data.

## Endpoints

Base prefix:

```text
/api/analytics/v1
```

| Method | URI | Description |
| --- | --- | --- |
| `GET` | `/health` | Public health check. |
| `GET` | `/students/{student_id}/attendance-risk` | Scoped attendance percentage, risk level and recommendation. |
| `GET` | `/students/{student_id}/scholarship-readiness` | Scoped scholarship threshold comparison using active scholarship rule. |
| `GET` | `/branches/{branch_id}/performance-summary` | Scoped student, teacher, session and attendance summary by branch. |
| `GET` | `/teachers/{teacher_id}/workload-summary` | Scoped completed hours, open check-ins and estimated pay. |

## Cache Headers

- `/health` returns `Cache-Control: public, max-age=60, must-revalidate` and `X-Cache-Policy: public-health-short`.
- Protected analytics endpoints return `Cache-Control: no-store, no-cache, must-revalidate, private` and `X-Cache-Policy: sensitive-no-store`.
- Authentication errors also return no-store headers so private analytics data is never cached by browsers or shared proxies.

## Local Setup

```bash
cd 06Code/apis/python-analytics-api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

For Linux/macOS:

```bash
source .venv/bin/activate
```

## Required Environment

```text
DATABASE_URL=<local-private-database-url>
SESSION_SECRET=<same-32+-character-secret-used-by-node-auth-api>
JWT_ISSUER=american-latin-class-auth
JWT_AUDIENCE=american-latin-class-services
ANALYTICS_AUTH_REQUIRED=true
ANALYTICS_CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

`ANALYTICS_AUTH_REQUIRED=false` is accepted only when `NODE_ENV=test`; all other environments fail startup.

## Tests

```bash
cd 06Code/apis/python-analytics-api
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## AWS Target

Recommended EC2 service:

```text
Python Analytics API EC2
Port: 8000
Process: uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Nginx can proxy:

```text
https://academy.example.invalid/api/analytics/v1/*
```

to:

```text
http://<python-analytics-private-ip>:8000/api/analytics/v1/*
```
