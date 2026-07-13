require('dotenv').config();

const VALID_NODE_ENVS = new Set(['development', 'test', 'staging', 'production']);
const VALID_DATABASE_DRIVERS = new Set(['memory', 'prisma', 'pg']);
const DEPLOYED_ENVS = new Set(['staging', 'production']);
const DEFAULT_TEST_SECRET = 'test-only-session-secret-32-characters-minimum';

function isTrue(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildEnv(source = process.env) {
  const nodeEnv = String(source.NODE_ENV || 'development').trim().toLowerCase();
  const isTest = nodeEnv === 'test';
  const databaseUrl = source.DATABASE_URL || '';
  const requestedDatabaseDriver = source.DB_DRIVER || (databaseUrl ? 'prisma' : 'memory');
  const mockGoogleTokensRequested = isTrue(source.ALLOW_MOCK_GOOGLE_TOKENS);
  const postmanLoginRequested = isTrue(source.POSTMAN_LOGIN_ENABLED);
  const exposeSessionTokenRequested = isTrue(source.EXPOSE_SESSION_TOKEN);

  return {
    nodeEnv,
    host:String(source.HOST || (DEPLOYED_ENVS.has(nodeEnv) ? '0.0.0.0' : '127.0.0.1')).trim(),
    port:Number(source.PORT || 3000),
    databaseDriver:String(requestedDatabaseDriver).trim().toLowerCase(),
    databaseUrl,
    allowInMemoryDatabase:isTest || isTrue(source.ALLOW_IN_MEMORY_DB),
    sessionSecret:source.SESSION_SECRET || (isTest ? DEFAULT_TEST_SECRET : ''),
    sessionTtlMinutes:Number(source.SESSION_TTL_MINUTES || 120),
    jwtIssuer:source.JWT_ISSUER || 'american-latin-class-auth',
    jwtAudience:source.JWT_AUDIENCE || 'american-latin-class-services',
    googleClientId:source.GOOGLE_CLIENT_ID || (isTest ? 'test-google-client-id' : ''),
    allowMockGoogleTokens:isTest,
    mockGoogleTokensRequested,
    postmanLoginEnabled:isTest && postmanLoginRequested,
    postmanLoginRequested,
    postmanLoginEmail:isTest ? (source.POSTMAN_LOGIN_EMAIL || '') : '',
    postmanLoginPassword:isTest ? (source.POSTMAN_LOGIN_PASSWORD || '') : '',
    exposeSessionToken:isTest || (nodeEnv === 'development' && exposeSessionTokenRequested),
    exposeSessionTokenRequested,
    corsOrigins:csv(source.CORS_ORIGINS || (isTest || nodeEnv === 'development' ? 'http://localhost:3000,http://localhost:5173' : '')),
    teacherHourlyRate:Number(source.TEACHER_HOURLY_RATE || 12.5),
    authRateLimitMax:Number(source.AUTH_RATE_LIMIT_MAX || 20),
    trustProxy:isTrue(source.TRUST_PROXY) || DEPLOYED_ENVS.has(nodeEnv),
    secureCookies:DEPLOYED_ENVS.has(nodeEnv) || isTrue(source.COOKIE_SECURE),
    forceHttps:DEPLOYED_ENVS.has(nodeEnv) || isTrue(source.FORCE_HTTPS),
    csrfProtectionEnabled:nodeEnv !== 'test' || isTrue(source.ENFORCE_CSRF_IN_TEST),
    jsonBodyLimitBytes:Number(source.JSON_BODY_LIMIT_BYTES || 100 * 1024),
  };
}

function validateOrigin(origin, nodeEnv) {
  if (origin === '*') throw new Error('CORS_ORIGINS cannot contain a wildcard when credentials are enabled.');
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(`Invalid CORS origin: ${origin}`);
  }
  if (parsed.origin !== origin || parsed.username || parsed.password) {
    throw new Error(`CORS origins must be exact origins without credentials or paths: ${origin}`);
  }
  if (DEPLOYED_ENVS.has(nodeEnv) && parsed.protocol !== 'https:') {
    throw new Error(`CORS origins must use HTTPS in ${nodeEnv}: ${origin}`);
  }
}

function validateRuntimeEnv(config) {
  if (!VALID_NODE_ENVS.has(config.nodeEnv)) {
    throw new Error(`Unsupported NODE_ENV: ${config.nodeEnv}`);
  }
  if (!VALID_DATABASE_DRIVERS.has(config.databaseDriver)) {
    throw new Error(`Unsupported DB_DRIVER: ${config.databaseDriver}`);
  }

  if (config.databaseDriver === 'memory') {
    const allowedMemoryMode = config.nodeEnv === 'test'
      || (config.nodeEnv === 'development' && config.allowInMemoryDatabase);
    if (!allowedMemoryMode) {
      throw new Error('The in-memory database is test-only unless ALLOW_IN_MEMORY_DB=true is explicitly set in development.');
    }
  } else if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required for prisma/pg database drivers.');
  }

  if (config.nodeEnv !== 'test' && (!config.sessionSecret || config.sessionSecret.length < 32)) {
    throw new Error('SESSION_SECRET must be explicitly configured with at least 32 characters outside tests.');
  }
  if (!Number.isInteger(config.sessionTtlMinutes) || config.sessionTtlMinutes < 5 || config.sessionTtlMinutes > 24 * 60) {
    throw new Error('SESSION_TTL_MINUTES must be an integer between 5 and 1440.');
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  if (!config.host || !/^[A-Za-z0-9.:[\]-]+$/.test(config.host)) {
    throw new Error('HOST must be a hostname or IP address without a protocol or path.');
  }
  if (!Number.isInteger(config.authRateLimitMax) || config.authRateLimitMax < 1 || config.authRateLimitMax > 1000) {
    throw new Error('AUTH_RATE_LIMIT_MAX must be an integer between 1 and 1000.');
  }
  if (!Number.isInteger(config.jsonBodyLimitBytes) || config.jsonBodyLimitBytes < 1024 || config.jsonBodyLimitBytes > 1024 * 1024) {
    throw new Error('JSON_BODY_LIMIT_BYTES must be an integer between 1024 and 1048576.');
  }
  if (!config.jwtIssuer || !config.jwtAudience) {
    throw new Error('JWT_ISSUER and JWT_AUDIENCE must be configured.');
  }

  if (config.mockGoogleTokensRequested && config.nodeEnv !== 'test') {
    throw new Error('ALLOW_MOCK_GOOGLE_TOKENS is forbidden outside tests.');
  }
  if (config.postmanLoginRequested && config.nodeEnv !== 'test') {
    throw new Error('POSTMAN_LOGIN_ENABLED is forbidden outside tests.');
  }
  if (config.exposeSessionTokenRequested && !['development', 'test'].includes(config.nodeEnv)) {
    throw new Error('EXPOSE_SESSION_TOKEN is forbidden in staging/production.');
  }
  if (config.postmanLoginEnabled && (!config.postmanLoginEmail || String(config.postmanLoginPassword).length < 12)) {
    throw new Error('Test-only Postman login requires an email and a password of at least 12 characters.');
  }

  if (!config.corsOrigins.length) throw new Error('At least one exact CORS_ORIGINS value is required.');
  config.corsOrigins.forEach((origin) => validateOrigin(origin, config.nodeEnv));

  if (DEPLOYED_ENVS.has(config.nodeEnv)) {
    if (config.databaseDriver === 'memory') throw new Error('A persistent database is required in staging/production.');
    if (!config.googleClientId || config.googleClientId === 'test-google-client-id') {
      throw new Error('GOOGLE_CLIENT_ID must be configured in staging/production.');
    }
    if (!config.secureCookies || !config.forceHttps) {
      throw new Error('Secure cookies and HTTPS enforcement are mandatory in staging/production.');
    }
  }

  return config;
}

const env = validateRuntimeEnv(buildEnv());

module.exports = {
  DEFAULT_TEST_SECRET,
  VALID_DATABASE_DRIVERS,
  buildEnv,
  env,
  validateRuntimeEnv,
};
