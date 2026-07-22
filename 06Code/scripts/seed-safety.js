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

function assertAcademicDemoSeed(seedName) {
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  if (nodeEnv === 'development') {
    assertLocalDevelopmentSeed(seedName);
    return;
  }

  if (!['staging', 'production'].includes(nodeEnv)) {
    throw new Error(`${seedName} requires development, staging, or production with explicit safeguards.`);
  }
  if (process.env.ALLOW_REMOTE_DEMO_SEEDS !== 'true') {
    throw new Error('Set ALLOW_REMOTE_DEMO_SEEDS=true explicitly for the controlled defense dataset.');
  }
  if (process.env.REMOTE_DEMO_SEED_CONFIRM !== 'RESET_ALC_DEFENSE_DATA') {
    throw new Error('REMOTE_DEMO_SEED_CONFIRM must exactly match RESET_ALC_DEFENSE_DATA.');
  }

  const databaseUrl = requiredSeedValue('DATABASE_URL');
  const parsed = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!parsed.hostname.endsWith('.rds.amazonaws.com')) {
    throw new Error('Remote defense seeds are restricted to an explicitly confirmed AWS RDS target.');
  }
  if (requiredSeedValue('REMOTE_DEMO_SEED_DATABASE') !== databaseName) {
    throw new Error('REMOTE_DEMO_SEED_DATABASE does not match DATABASE_URL.');
  }
}

module.exports = { assertAcademicDemoSeed, assertLocalDevelopmentSeed, requiredSeedValue };
