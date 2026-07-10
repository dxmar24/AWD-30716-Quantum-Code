# Demo Data and Visual Database Access

## Persistent Cloud Viewer

The project also includes a persistent browser-based database viewer for AWS verification:

```text
https://18-217-255-109.sslip.io/db-admin/
```

The route is protected with Nginx Basic Auth and uses Adminer running locally on the Frontend EC2 instance. The recommended PostgreSQL user for visual inspection is `alc_readonly`.

Credential details are intentionally kept outside Git in:

```text
07Other/local-secrets/database-viewer-credentials.txt
```

Full setup and evidence instructions are documented in `03Documentation/cloud-database-viewer.md`.

## Academic Demo Seed

Run this seed after applying database migrations when you need realistic report data:

```bash
cd 06Code
npm run db:seed:academic-demo
```

In production or staging, explicitly allow demo data seeding:

```bash
ALLOW_DEMO_ACADEMIC_SEED=true npm run db:seed:academic-demo
```

The seed creates:

- 2 academy branches.
- 20 student users across B1 and B2.
- 6 teacher users, one per dance rhythm/class.
- Named class groups and sessions such as Hip Hop Foundation, Afro Foundation, Dancehall Skanking, Salsa Level 1, Bachata Sensual and Heels Technique.
- Student payments with paid, pending and overdue examples.
- Attendance records for report testing.
- Academy events with B1, B2 and all-level visibility.
- Show income records through academy events.

## Demo User Credentials

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@alc.edu` | `adminALC2026*` |
| General Director | `generaldirector@alc.edu` | `generaldirectorALC2026*` |
| Branch Director Norte | `branchdirector.norte@alc.edu` | `branchdirectorALC2026*` |
| Branch Director Central | `branchdirector.central@alc.edu` | `branchdirectorALC2026*` |
| Teacher Hip Hop | `teacher.hiphop@alc.edu` | `teacherALC2026*` |
| Teacher Afro | `teacher.afro@alc.edu` | `teacherALC2026*` |
| Teacher Dancehall | `teacher.dancehall@alc.edu` | `teacherALC2026*` |
| Teacher Salsa | `teacher.salsa@alc.edu` | `teacherALC2026*` |
| Teacher Bachata | `teacher.bachata@alc.edu` | `teacherALC2026*` |
| Teacher Heels | `teacher.heels@alc.edu` | `teacherALC2026*` |
| Student 01-20 | `student01@alc.edu` through `student20@alc.edu` | `studentALC2026*` |

## Visual Database Access With DBeaver or pgAdmin

Use an SSH tunnel instead of opening the database publicly.

1. Open a terminal on Windows.
2. Start a local tunnel through the Core Business API EC2 instance:

```powershell
ssh -i "C:\Users\User\Downloads\damaralexander.pem" -N -L 15432:american-latin-class.c38uoym8e77j.us-east-2.rds.amazonaws.com:5432 ubuntu@3.15.207.113
```

3. Keep that terminal open while using the database tool.
4. Open DBeaver, pgAdmin, DataGrip or another PostgreSQL client.
5. Create a PostgreSQL connection with:

| Field | Value |
| --- | --- |
| Host | `localhost` |
| Port | `15432` |
| Database | `american_latin_class` |
| User | `alc_user` |
| Password | Use the RDS password from the API instance `.env` |

6. Test the connection.
7. Expand the `public` schema to browse tables such as:

- `users`
- `students`
- `teachers`
- `class_groups`
- `class_sessions`
- `academy_events`
- `student_payments`
- `student_attendance_records`

## Local Docker Alternative

For a local visual database without AWS:

```bash
cd 06Code
npm run db:local:up
npm run db:push
npm run db:seed:academic-demo
```

Then connect DBeaver or pgAdmin to:

| Field | Value |
| --- | --- |
| Host | `localhost` |
| Port | `5432` |
| Database | `american_latin_class` |
| User | `alc_user` |
| Password | `change_me` |
