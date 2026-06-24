const { env } = require('../config/env');
const { DatabaseContext } = require('./DatabaseContext');

function createDatabaseContext() {
  if (env.nodeEnv !== 'test' && env.databaseDriver === 'prisma' && env.databaseUrl) {
    const { PrismaDatabaseContext } = require('./PrismaDatabaseContext');
    return new PrismaDatabaseContext();
  }
  if (env.nodeEnv !== 'test' && env.databaseDriver === 'pg' && env.databaseUrl) {
    const { PostgresDatabaseContext } = require('./PostgresDatabaseContext');
    return new PostgresDatabaseContext(env.databaseUrl);
  }
  return new DatabaseContext();
}

module.exports = { createDatabaseContext };
