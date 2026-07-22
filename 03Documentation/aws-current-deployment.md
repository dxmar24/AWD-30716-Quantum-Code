# Current AWS Deployment Record

This record describes the staging deployment verified on July 22, 2026. Public EC2 addresses are ephemeral and can change whenever an instance is stopped and started.

## Deployed Release

- Git branch: `agent/academy-hardening`
- Git commit: `8238008`
- Public application URL: `https://3-19-30-6.sslip.io`
- PostgreSQL: RDS instance `american-latin-class`
- RDS endpoint: `american-latin-class.c38uoym8e77j.us-east-2.rds.amazonaws.com`
- Applied database migrations: `001` through `013`

## Instance Map

| Responsibility | Public IP | Private IP | Runtime |
| --- | --- | --- | --- |
| Frontend and HTTPS proxy | `3.19.30.6` | `172.31.40.244` | Nginx and Vite static build |
| Core Business API | `3.131.137.0` | `172.31.36.254` | PM2 `alc-api-core`, port `3000` |
| Reports and Rules API | `18.218.87.164` | `172.31.32.254` | PM2 `alc-api-reports`, port `3002` |
| Auth and Session API | `18.227.61.152` | `172.31.43.146` | PM2 `alc-api-auth`, port `3001` |
| Python Analytics API | `52.14.74.88` | `172.31.45.140` | systemd `alc-python-analytics`, port `8000` |

The three Node instances run the same deployable backend. Nginx separates route groups, but the repository does not claim that these are independently implemented microservices.

## Verification Completed

- Frontend build: 32 Vite modules built successfully.
- Node tests: 94 of 94 passed locally before deployment.
- API validation scenarios: 134 of 134 passed.
- Postman route coverage: 89 of 89 route contracts represented by 110 requests.
- Python tests: 15 of 15 passed locally and again on the Analytics instance.
- Public health checks: landing, login, Node liveness/readiness and Python health returned HTTP `200` over HTTPS.
- Cross-instance flow: login, current user, branches, general report, attendance report and CSRF-protected logout returned HTTP `200`.
- RDS backup before deployment: `/home/ubuntu/deploy-backups/alc-rds-before-013-20260722161917.dump` on the Core instance.
- Frontend rollback copy: `/var/www/alc-frontend.previous-20260722163158` on the Frontend instance.

## Email Environment

The staging environment uses Mailpit on `127.0.0.1:1025` of the Core instance. Its web inbox is bound to `127.0.0.1:8025` and is not publicly exposed. The branded invitation was accepted by SMTP and captured during deployment verification.

This is staging evidence, not external mailbox delivery. Before production, replace `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `EMAIL_FROM` with a real transactional SMTP provider. Do not claim that Mailpit delivers to Gmail or Outlook.

## Security Group Checklist

- Allow public TCP `80` and `443` only on the Frontend instance.
- Allow TCP `3000-3002` only from the Frontend security group, never from `0.0.0.0/0`.
- Allow TCP `8000` only from the Frontend security group.
- Keep RDS `5432` reachable only from the application security group.
- Remove the temporary public SSH `22` rule after deployment, or restrict it to the current administrator IP.
- Never expose Mailpit `1025/8025` or a database viewer without authentication.

## Restart Warning

Stopping EC2 instances reduces compute cost, but starting them again can assign new public IP addresses. If the Frontend IP changes, update the `sslip.io` hostname, TLS certificate, Nginx `server_name`, `APP_PUBLIC_URL`, Node `CORS_ORIGINS` and Analytics `ANALYTICS_CORS_ORIGINS`. Private IP routing should also be checked after every restart.
