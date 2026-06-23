require('dotenv').config();
const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  sessionSecret: process.env.SESSION_SECRET || 'development_secret_change_me',
  googleClientId: process.env.GOOGLE_CLIENT_ID || 'test-google-client-id',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8080').split(',').map((v) => v.trim()),
  teacherHourlyRate: Number(process.env.TEACHER_HOURLY_RATE || 12.5),
};
module.exports = { env };
