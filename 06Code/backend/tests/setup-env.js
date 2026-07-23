// The automated suite must never inherit a developer or deployment database.
process.env.DB_DRIVER = 'memory';
process.env.DATABASE_URL = '';
process.env.EMAIL_TRANSPORT = 'capture';
process.env.APP_PUBLIC_URL = 'http://127.0.0.1:3000';
