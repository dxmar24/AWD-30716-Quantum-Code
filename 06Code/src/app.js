const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const { env } = require('./config/env');
const { createDatabaseContext } = require('./repositories/createDatabaseContext');
const { AuthService } = require('./services/AuthService');
const { AuditService } = require('./services/AuditService');
const { AttendanceService } = require('./services/AttendanceService');
const { RulesService } = require('./services/RulesService');
const { AcademicService } = require('./services/AcademicService');
const { buildApi } = require('./routes/api');
const { errorHandler } = require('./middleware/errorHandler');
const { sessionResolver } = require('./middleware/sessionResolver');
const { noStore } = require('./middleware/cacheControl');
const { privatePageGuard } = require('./middleware/privatePageGuard');

function frontendIndexPath(frontendBuildPath) {
  const builtIndex = path.join(frontendBuildPath, 'index.html');
  if (fs.existsSync(builtIndex)) return builtIndex;
  return path.join(__dirname, '..', 'frontend', 'index.html');
}

function createApp() {
  const app = express();
  if (env.trustProxy) app.set('trust proxy', 1);
  const db = createDatabaseContext();
  const auditService = new AuditService(db);
  const authService = new AuthService(db);
  const attendanceService = new AttendanceService(db, auditService);
  const rulesService = new RulesService(db, attendanceService);
  const academicService = new AcademicService(db, auditService, rulesService);
  const frontendBuildPath = path.join(__dirname, '..', 'dist', 'frontend');
  const publicPath = path.join(__dirname, '..', 'public');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://*.googleusercontent.com', 'https://*.gstatic.com'],
        connectSrc: ["'self'", 'https://accounts.google.com'],
        frameSrc: ["'self'", 'https://accounts.google.com'],
      },
    },
  }));
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(sessionResolver(authService));
  app.use('/private', noStore, privatePageGuard);
  app.use(express.static(frontendBuildPath));
  app.use(express.static(publicPath));
  app.use('/api/v1', noStore, buildApi({ db, authService, attendanceService, rulesService, academicService }));
  app.get(['/login.html', '/login'], (req, res) => res.sendFile(frontendIndexPath(frontendBuildPath)));
  app.get(['/private/dashboard.html', '/private/*'], (req, res) => res.sendFile(frontendIndexPath(frontendBuildPath)));
  app.get('/', (req, res) => res.sendFile(frontendIndexPath(frontendBuildPath)));
  app.use(errorHandler);
  app.locals.db = db;
  return app;
}

module.exports = { createApp };
