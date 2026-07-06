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

## Local Setup

```bash
cd 06Code/python-analytics-api
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
DATABASE_URL=postgres://alc_user:change_me@localhost:5432/american_latin_class
SESSION_SECRET=same_secret_used_by_node_auth_api
ANALYTICS_AUTH_REQUIRED=true
ANALYTICS_CORS_ORIGINS=https://18-217-255-109.sslip.io
```

For isolated local development without database authentication, `ANALYTICS_AUTH_REQUIRED=false` can be used, but AWS deployment should keep authentication enabled.

## Tests

```bash
cd 06Code/python-analytics-api
python -m unittest discover -s tests
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
https://18-217-255-109.sslip.io/api/analytics/v1/*
```

to:

```text
http://<python-analytics-private-ip>:8000/api/analytics/v1/*
```
