function requiredSeedValue(name, minimumLength = 1) {
  const value = String(process.env[name] || '').trim();
  if (value.length < minimumLength) {
    throw new Error(`${name} must be supplied explicitly${minimumLength > 1 ? ` with at least ${minimumLength} characters` : ''}.`);
  }
  return value;
}

function assertLocalDevelopmentSeed(seedName) {
  if (String(process.env.NODE_ENV || '').toLowerCase() !== 'development') {
    throw new Error(`${seedName} is restricted to NODE_ENV=development and can never run in test, staging, or production.`);
  }
  if (process.env.ALLOW_LOCAL_DEMO_SEEDS !== 'true') {
    throw new Error('Set ALLOW_LOCAL_DEMO_SEEDS=true explicitly for disposable local demo data.');
  }
  const databaseUrl = requiredSeedValue('DATABASE_URL');
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Demo seeds require a PostgreSQL DATABASE_URL.');
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error('Demo seeds are restricted to a database on localhost.');
  }
}

module.exports = { assertLocalDevelopmentSeed, requiredSeedValue };
