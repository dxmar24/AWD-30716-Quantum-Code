# American Latin Class Academy Management System

Sistema web para operar una academia de baile con trazabilidad académica, comercial y financiera. El proyecto ejecutable está en `06Code`; requisitos, documentación, UML, pruebas y evidencia permanecen en las carpetas numeradas.

El sistema incluye autenticación y control de acceso por rol/sede, matrículas con cupo y lista de espera, agenda de clases, asistencia por roster, justificaciones, becas y promociones, jornada/pago docente, prospectos, cartera, reversos, reportes gerenciales, alertas de calidad y bitácora de auditoría.

## Inicio rápido

Requisitos: Node.js `>=20.19`, PostgreSQL y una copia local de `06Code/.env.example` como `06Code/.env` con secretos propios. No use credenciales de ejemplo en un entorno compartido.

```bash
cd 06Code
npm ci
npm run db:generate
npm run db:migrate
npm run db:migrate:status
npm start
```

`npm start` compila el frontend React antes de iniciar Express. Abra `http://localhost:3000` salvo que cambie `PORT`.

Para crear el primer administrador, únicamente después de aplicar migraciones y antes de que exista otro Admin activo:

```bash
BOOTSTRAP_ADMIN_CONFIRM=CREATE_INITIAL_ADMIN \
BOOTSTRAP_ADMIN_EMAIL=admin@example.invalid \
BOOTSTRAP_ADMIN_NAME="Initial Administrator" \
BOOTSTRAP_ADMIN_PASSWORD='<strong-one-time-password>' \
npm run db:bootstrap-admin
```

La contraseña debe tener 14–120 caracteres, mayúscula, minúscula, número y símbolo. El usuario queda obligado a cambiarla al ingresar; retire inmediatamente todas las variables `BOOTSTRAP_ADMIN_*`.

## Modos de ejecución

- Producción y staging exigen PostgreSQL mediante Prisma, `DATABASE_URL` y configuración segura; el proceso falla cerrado si faltan valores críticos.
- La base en memoria se admite en pruebas o en desarrollo con aceptación explícita mediante `ALLOW_IN_MEMORY_DB=true`; nunca es persistencia de producción.
- Google OAuth verifica el token con Google fuera de pruebas. No crea usuarios ni concede roles: la cuenta, rol, estado y alcance de sede pertenecen a la aplicación.
- La API Node usa `/api/v1`; la API FastAPI de analítica usa `/api/analytics/v1` y valida la misma sesión.

## Verificación

```bash
cd 06Code
npm test
npm run frontend:build
npm audit
npm run db:smoke:operational   # requiere PostgreSQL y revierte sus datos de prueba

cd python-analytics-api
python -m pytest -q
```

## Documentación operativa

- Contratos y runbook: `03Documentation/system-hardening-and-business-rules.md`
- API: `03Documentation/api-documentation.md`
- Base de datos y migraciones: `03Documentation/database.md`
- Despliegue AWS: `03Documentation/aws-deployment-guide.md`
- Requisitos y trazabilidad: `02Requirements/requirements.md`

## Stack

- Node.js + Express, React + Vite y FastAPI.
- PostgreSQL con Prisma como acceso de datos obligatorio en despliegue.
- Zod para validación, JWT respaldado por sesiones revocables y Jest/Pytest para pruebas.

No ejecute sincronización destructiva o implícita del esquema. `npm run db:migrate` es el único flujo documentado: usa migraciones SQL versionadas, bloqueo asesor, checksum y transacción por archivo.
