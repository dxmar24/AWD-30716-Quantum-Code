require('dotenv').config();
const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseDriver: process.env.DB_DRIVER || (process.env.DATABASE_URL ? 'prisma' : 'memory'),
  databaseUrl: process.env.DATABASE_URL || '',
  sessionSecret: process.env.SESSION_SECRET || 'development_secret_change_me',
  sessionTtlMinutes: Number(process.env.SESSION_TTL_MINUTES || 120),
  googleClientId: process.env.GOOGLE_CLIENT_ID || 'test-google-client-id',
  allowMockGoogleTokens: process.env.ALLOW_MOCK_GOOGLE_TOKENS === 'true' || process.env.NODE_ENV === 'test',
  postmanLoginEnabled: process.env.POSTMAN_LOGIN_ENABLED === 'true' || process.env.NODE_ENV === 'test',
  postmanLoginEmail: process.env.POSTMAN_LOGIN_EMAIL || (process.env.NODE_ENV === 'test' ? 'admin@alc.edu' : ''),
  postmanLoginPassword: process.env.POSTMAN_LOGIN_PASSWORD || (process.env.NODE_ENV === 'test' ? 'AmericanLatin2026!' : ''),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8080').split(',').map((v) => v.trim()),
  teacherHourlyRate: Number(process.env.TEACHER_HOURLY_RATE || 12.5),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  trustProxy: process.env.TRUST_PROXY === 'true' || ['production', 'staging'].includes(process.env.NODE_ENV),
};

function validateRuntimeEnv(config) {
  const isDeployed = ['production', 'staging'].includes(config.nodeEnv);
  if (!isDeployed) return;

  if (!config.sessionSecret || config.sessionSecret === 'development_secret_change_me' || config.sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be configured with at least 32 characters in production/staging.');
  }
  if (!config.databaseUrl || config.databaseDriver === 'memory') {
    throw new Error('DATABASE_URL and a persistent DB_DRIVER are required in production/staging.');
  }
  if (!config.googleClientId || config.googleClientId === 'test-google-client-id') {
    throw new Error('GOOGLE_CLIENT_ID must be configured in production/staging.');
  }
  if (config.allowMockGoogleTokens) {
    throw new Error('ALLOW_MOCK_GOOGLE_TOKENS must be false in production/staging.');
  }
  if (config.postmanLoginEnabled) {
    const password = String(config.postmanLoginPassword || '');
    if (!config.postmanLoginEmail || password.length < 12 || password === 'change_this_postman_demo_password' || password === 'AmericanLatin2026!') {
      throw new Error('POSTMAN_LOGIN_* must use non-placeholder credentials when enabled in production/staging.');
    }
  }
}

validateRuntimeEnv(env);

module.exports = { env };
