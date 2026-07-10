# Cloud Database Viewer

## Objective

The project keeps PostgreSQL on Amazon RDS as the main production database and adds a persistent cloud database viewer so the team can inspect tables from a browser without rebuilding SSH tunnels every time.

This is intended for academic verification and controlled administration, not for exposing the database publicly without protection.

## Decision

The recommended option is:

- Keep Amazon RDS PostgreSQL as the source of truth.
- Keep the database private at the network level.
- Run Adminer on the Frontend EC2 instance as a local-only Docker container.
- Expose Adminer through the existing HTTPS Nginx site under `/db-admin/`.
- Protect the route with Nginx Basic Auth.
- Use a read-only PostgreSQL user for visual inspection.

This keeps the relational model already built for American Latin Class and avoids migrating to a document database that does not match the current data relationships.

## Why Not MongoDB

MongoDB is useful for document-oriented data, but this system depends heavily on relational integrity:

- Users belong to roles.
- Branch directors have branch access records.
- Students belong to branches.
- Attendance records reference class sessions.
- Payments reference students and branches.
- Events belong to branches and can be filtered by level.
- Reports aggregate related academic and financial data.

PostgreSQL is a better fit for this structure.

## Why Not Public RDS Access

Opening RDS directly to the internet would make the database harder to protect. The safer setup is to keep RDS private and let only trusted EC2 instances reach it.

The browser-based viewer reaches the database from the Frontend EC2 instance, which is already inside the AWS network.

## Implemented Architecture

```text
Browser
  |
  | HTTPS
  v
Nginx on Frontend EC2
  |
  | Basic Auth at /db-admin/
  v
Adminer Docker container on 127.0.0.1:18080
  |
  | PostgreSQL connection inside AWS network
  v
Amazon RDS PostgreSQL
```

## Security Controls

- RDS remains private.
- Adminer listens only on `127.0.0.1:18080` on the EC2 instance.
- Nginx is the only public entry point.
- `/db-admin/` is protected with Basic Auth.
- The database viewer uses a PostgreSQL read-only user.
- The route sends `Cache-Control: no-store`.
- Credentials are not stored in the Git repository.

## Access URL

Use:

```text
https://18-217-255-109.sslip.io/db-admin/
```

First, the browser asks for the Nginx Basic Auth credentials.

Then Adminer asks for the PostgreSQL connection fields.

## Adminer Connection Fields

| Field | Value |
| --- | --- |
| System | `PostgreSQL` |
| Server | `american-latin-class.c38uoym8e77j.us-east-2.rds.amazonaws.com` |
| Username | `alc_readonly` |
| Password | Stored locally in `07Other/local-secrets/database-viewer-credentials.txt` |
| Database | `american_latin_class` |

## What Can Be Reviewed

After login, expand the `public` schema and inspect:

- `users`
- `students`
- `teachers`
- `branches`
- `class_groups`
- `class_sessions`
- `student_attendance_records`
- `student_payments`
- `academy_events`
- `audit_logs`

The read-only user is meant for review and evidence screenshots. Application changes should still go through the system UI or approved migrations.

## Operational Commands

Check the Adminer container:

```bash
sudo docker ps --filter name=alc-db-adminer
```

Restart the viewer:

```bash
sudo docker restart alc-db-adminer
```

Review Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Evidence to Capture

For the academic delivery, capture screenshots of:

- The `/db-admin/` Basic Auth prompt.
- The Adminer PostgreSQL login screen.
- The `public` schema table list.
- The `students` table.
- The `student_payments` table.
- The `academy_events` table.
- The `student_attendance_records` table.

Avoid capturing passwords.
