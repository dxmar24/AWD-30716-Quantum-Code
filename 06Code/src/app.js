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
const { AccessPolicy } = require('./services/AccessPolicy');
const { AttendanceService } = require('./services/AttendanceService');
const { RulesService } = require('./services/RulesService');
const { AcademicService } = require('./services/AcademicService');
const { FinancialService } = require('./services/FinancialService');
const { CacheService } = require('./services/CacheService');
const { buildApi } = require('./routes/api');
const { errorHandler } = require('./middleware/errorHandler');
const { sessionResolver } = require('./middleware/sessionResolver');
const { requestContext } = require('./middleware/requestContext');
const { csrfProtection } = require('./middleware/csrfProtection');
const { httpsOnly } = require('./middleware/httpsOnly');
const { noStore, staticAssetHeaders } = require('./middleware/cacheControl');
const { privatePageGuard } = require('./middleware/privatePageGuard');

function frontendIndexPath(frontendBuildPath) {
  const builtIndex = path.join(frontendBuildPath, 'index.html');
  if (fs.existsSync(builtIndex)) return builtIndex;
  return path.join(__dirname, '..', 'frontend', 'index.html');
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', 1);
  const db = createDatabaseContext();
  const cacheService = new CacheService();
  const accessPolicy = new AccessPolicy(db);
  const auditService = new AuditService(db);
  const authService = new AuthService(db, undefined, auditService);
  const attendanceService = new AttendanceService(db, auditService, accessPolicy, cacheService);
  const rulesService = new RulesService(db, attendanceService);
  const academicService = new AcademicService(db, auditService, rulesService, accessPolicy, cacheService);
  const financialService = new FinancialService(db, auditService, accessPolicy, cacheService);
  const frontendBuildPath = path.join(__dirname, '..', 'dist', 'frontend');
  const publicPath = path.join(__dirname, '..', 'public');

  app.use(requestContext);
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
    crossOriginEmbedderPolicy:false,
    referrerPolicy:{ policy:'no-referrer' },
    strictTransportSecurity:env.forceHttps
      ? { maxAge:31536000, includeSubDomains:true, preload:true }
      : false,
  }));
  app.use(httpsOnly(env.forceHttps));
  app.use(cors({
    allowedHeaders:['Authorization', 'Content-Type', 'X-CSRF-Token', 'X-Request-ID'],
    credentials:true,
    methods:['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  }));
  app.use(cookieParser());
  app.use(csrfProtection({ enabled:env.csrfProtectionEnabled, allowedOrigins:env.corsOrigins }));
  app.use(express.json({ limit:env.jsonBodyLimitBytes, strict:true }));
  app.use(sessionResolver(authService));
  app.use('/private', noStore, privatePageGuard);
  app.use(express.static(frontendBuildPath, { setHeaders:staticAssetHeaders }));
  app.use(express.static(publicPath, { setHeaders:staticAssetHeaders }));
  app.use('/api/v1', buildApi({
    db,
    authService,
    attendanceService,
    rulesService,
    academicService,
    financialService,
    auditService,
    accessPolicy,
    cacheService,
  }));
  app.get(['/login.html', '/login'], (req, res) => res.sendFile(frontendIndexPath(frontendBuildPath)));
  app.get(['/private/dashboard.html', '/private/*'], (req, res) => res.sendFile(frontendIndexPath(frontendBuildPath)));
  app.get('/', (req, res) => res.sendFile(frontendIndexPath(frontendBuildPath)));
  app.use(errorHandler);
  app.locals.db = db;
  app.locals.cache = cacheService;
  return app;
}

module.exports = { createApp };
