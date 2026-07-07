# AWS Deployment Guide

Do not use Render or Netlify. The target deployment uses EC2 plus Amazon RDS PostgreSQL.

## Services
| Service | Port | Responsibility |
|---|---:|---|
| Frontend EC2 + Nginx | 80/443 | Serve landing page and private web app static files. |
| Core Business API EC2 | 3000 | Branches, students, teachers, classes, schedules, attendance. |
| Auth & Session API EC2 | 3001 | Google OAuth, sessions, refresh/session revocation, roles. |
| Reports & Rules API EC2 | 3002 | Reports, scholarship candidates, promotion candidates, teacher hours/payment. |
| Python Analytics API EC2 | 8000 | Attendance risk, scholarship readiness, branch performance and workload analytics. |
| Amazon RDS PostgreSQL | 5432 | Normalized relational database. |

The current academic executable is one Express codebase. For AWS, run the same codebase as separate Node processes with route ownership documented above, or split by route module if the course requires physical service separation.

## Network
- VPC with public subnets for ALB/Nginx.
- Private app subnets for API EC2 instances.
- Private database subnets for RDS.
- Optional Application Load Balancer terminates HTTPS with ACM certificate.

## Security Groups
| Group | Inbound |
|---|---|
| ALB | `443` from internet, optional `80` redirect to HTTPS. |
| Frontend EC2 | `80/443` only from ALB. |
| API EC2 | `3000/3001/3002/8000` only from ALB or frontend security group. |
| RDS | `5432` only from Node API and Python Analytics API security groups. |

## Environment Variables
- `NODE_ENV=production`
- `DB_DRIVER=prisma`
- `DATABASE_URL=postgres://...`
- `SESSION_SECRET`
- `SESSION_TTL_MINUTES`
- `GOOGLE_CLIENT_ID`
- `ALLOW_MOCK_GOOGLE_TOKENS=false`
- `POSTMAN_LOGIN_ENABLED=true` only when the legacy configured Postman password-login fallback is required; normal user password login uses `users.password_hash`.
- `POSTMAN_LOGIN_EMAIL=verification-admin-real-20260624154645@alc.test`
- `POSTMAN_LOGIN_PASSWORD=<academic-demo-password>`
- `SEED_*_PASSWORD` only when running the temporary role-test seed; rotate or remove the seeded credentials before a real production handoff.
- `CORS_ORIGINS=https://app.americanlatinclass.edu`
- `AUTH_RATE_LIMIT_MAX=20`
- `AWS_REGION`

Python Analytics API variables:
- `DATABASE_URL=postgres://...`
- `SESSION_SECRET` with the same value used by the Auth & Session API.
- `ANALYTICS_AUTH_REQUIRED=true`
- `ANALYTICS_CORS_ORIGINS=https://18-217-255-109.sslip.io`
- `ANALYTICS_SERVICE_NAME=American Latin Class Analytics API`

Store secrets in AWS Systems Manager Parameter Store or Secrets Manager.
Production/staging processes fail fast if `SESSION_SECRET` is missing/default/short, `DATABASE_URL` is missing, mock Google tokens are enabled, or Postman verification credentials are left as placeholders.

Branch directors must be assigned to one or more branches through `/api/v1/users/{id}/branch-access`; otherwise their role authenticates successfully but has no branch-scoped data visibility.

## Deployment Steps
1. Create RDS PostgreSQL and run `migrations/001_initial_schema.sql`.
2. Existing deployments must also run `migrations/002_account_login_policy.sql`.
3. Run `seeders/001_seed.sql`.
4. For manual role testing, run `npm run db:seed:role-test` after setting temporary `SEED_*_PASSWORD` values.
5. For local rehearsal before AWS, use `cd 06Code && npm run db:local:up`, set `DATABASE_URL=postgres://alc_user:change_me@localhost:5432/american_latin_class`, then run `npm run db:push && npm run db:seed:role-test`.
6. Install Node.js LTS on EC2 instances.
7. Copy project or deploy from repository.
8. Run `npm ci --omit=dev` on production instances.
9. Start each Node process with its assigned port.
10. On the Python Analytics API EC2 instance, install Python, create a virtual environment, install `06Code/python-analytics-api/requirements.txt` and start Uvicorn on port `8000`.
11. Configure Nginx reverse proxy or ALB target groups.
12. Enable HTTPS and configure HSTS at ALB/Nginx.
13. Verify `/api/v1/auth/me`, `/api/v1/branches`, reports, `/api/analytics/v1/health`, cache headers and private page redirects.

## HTTPS Recommendation
Use ACM certificates on ALB. Redirect all HTTP traffic to HTTPS. Keep cookies Secure in production.

## Google OAuth Origins
For Google Sign-In, configure Authorized JavaScript origins with an HTTPS public domain:

- Local development: `http://localhost:5500`, `http://127.0.0.1:5500`
- Production: `https://app.americanlatinclass.edu` or another domain controlled by the team

Do not use raw public IP origins such as `http://18.217.255.109`; Google rejects them because they do not end with a public top-level domain. If the team uses a temporary DNS name, configure HTTPS first and add the exact origin used by the browser.

## React Frontend Build on EC2
Before starting the production Express process, build the React + Vite frontend:

```bash
cd 06Code
npm ci
npm run db:generate
npm run frontend:build
npm start
```

The Vite output is `06Code/dist/frontend`. Express serves that directory and keeps `/api/v1` as the API prefix. If Nginx is used, configure the site root to `06Code/dist/frontend` and proxy `/api/v1` to the Node.js process.

For the current EC2 frontend instance, the reference Nginx configuration is versioned at `07Other/nginx-alc-frontend.conf`. It includes:
- `/api/v1/auth/` proxy to Auth & Session API.
- `/api/v1/reports/` proxy to Reports & Rules API.
- `/api/analytics/v1/` proxy to Python Analytics API.
- `/api/v1/` proxy to Core Business API.
- `/private/` no-cookie redirect to `/login.html?session=expired` plus `Cache-Control: no-store`.
- `/assets/` immutable static cache with `Cache-Control: public, max-age=31536000, immutable`.
- `/` and `/login.html` HTML revalidation with `Cache-Control: no-cache, must-revalidate`.
- Temporary HTTPS host `https://18-217-255-109.sslip.io` for Google OAuth validation.

## Cache Management Deployment Checks

After deploying the latest code and reloading Nginx, verify cache policy headers through HTTPS:

```bash
curl -k -I https://18-217-255-109.sslip.io/
curl -k -I https://18-217-255-109.sslip.io/login.html
curl -k -I https://18-217-255-109.sslip.io/assets/<built-asset-file>
curl -k -I https://18-217-255-109.sslip.io/api/v1/auth/config
curl -k -I https://18-217-255-109.sslip.io/api/v1/auth/me
curl -k -I https://18-217-255-109.sslip.io/api/analytics/v1/health
```

Expected policies:
- HTML pages: `X-Cache-Policy: html-revalidate`.
- Static assets: `X-Cache-Policy: public-static-immutable`.
- Auth config: `X-Cache-Policy: public-auth-config`.
- Anonymous/private API responses: `X-Cache-Policy: sensitive-no-store`.
- Python health: `X-Cache-Policy: public-health-short`.

Authenticated memory-cache evidence can be validated by logging in, then repeating the same protected read twice:

```bash
curl -k -H "Authorization: Bearer <session-token>" https://18-217-255-109.sslip.io/api/v1/roles
curl -k -H "Authorization: Bearer <session-token>" https://18-217-255-109.sslip.io/api/v1/roles
```

The first response should include `X-Memory-Cache: MISS`; the repeated response should include `X-Memory-Cache: HIT`.

## Python Analytics API EC2

Recommended setup:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip
git clone https://github.com/dxmar24/AWD-30716-Quantum-Code.git
cd AWD-30716-Quantum-Code/06Code/python-analytics-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `.env` on the instance:

```text
DATABASE_URL=postgres://alc_user:<password>@american-latin-class.c38uoym8e77j.us-east-2.rds.amazonaws.com:5432/american_latin_class
SESSION_SECRET=<same secret used by Auth & Session API>
ANALYTICS_AUTH_REQUIRED=true
ANALYTICS_CORS_ORIGINS=https://18-217-255-109.sslip.io
```

Keep `ANALYTICS_AUTH_REQUIRED=true` in staging and production. The service validates the shared session and enforces student, teacher and branch resource scope before returning analytics.

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Production should run it with `systemd` or PM2 and proxy it through the Frontend EC2 Nginx site:

```nginx
location /api/analytics/v1/ {
    proxy_pass http://<python-analytics-private-ip>:8000/api/analytics/v1/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
