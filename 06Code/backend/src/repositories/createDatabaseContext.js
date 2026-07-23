const { env } = require('../config/env');
const { DatabaseContext } = require('./DatabaseContext');

function createDatabaseContext(config = env) {
  if (config.databaseDriver === 'memory') {
    const allowedMemoryMode = config.nodeEnv === 'test'
      || (config.nodeEnv === 'development' && config.allowInMemoryDatabase === true);
    if (!allowedMemoryMode) {
      throw new Error('Refusing to start with the in-memory database outside tests or explicit local development.');
    }
    return new DatabaseContext();
  }

  if (!config.databaseUrl) throw new Error('DATABASE_URL is required for a persistent database driver.');

  if (config.databaseDriver === 'prisma') {
    const { PrismaDatabaseContext } = require('./PrismaDatabaseContext');
    return new PrismaDatabaseContext();
  }
  if (config.databaseDriver === 'pg') {
    const { PostgresDatabaseContext } = require('./PostgresDatabaseContext');
    return new PostgresDatabaseContext(config.databaseUrl);
  }

  throw new Error(`Unsupported DB_DRIVER: ${config.databaseDriver}`);
}

module.exports = { createDatabaseContext };
