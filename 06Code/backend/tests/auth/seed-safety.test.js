const { assertAcademicDemoSeed } = require('../../../scripts/seed-safety');

const KEYS = [
  'NODE_ENV',
  'ALLOW_REMOTE_DEMO_SEEDS',
  'REMOTE_DEMO_SEED_CONFIRM',
  'REMOTE_DEMO_SEED_DATABASE',
  'DATABASE_URL',
];

describe('academic demo seed safeguards', () => {
  const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  function configureRemote(overrides = {}) {
    Object.assign(process.env, {
      NODE_ENV:'production',
      ALLOW_REMOTE_DEMO_SEEDS:'true',
      REMOTE_DEMO_SEED_CONFIRM:'RESET_ALC_DEFENSE_DATA',
      REMOTE_DEMO_SEED_DATABASE:'american_latin_class',
      DATABASE_URL:'postgresql://user:password@example.us-east-2.rds.amazonaws.com:5432/american_latin_class',
      ...overrides,
    });
  }

  test('rejects a deployed reset without explicit flags', () => {
    configureRemote({ ALLOW_REMOTE_DEMO_SEEDS:'false' });
    expect(() => assertAcademicDemoSeed('Defense reset')).toThrow('ALLOW_REMOTE_DEMO_SEEDS');
  });

  test('rejects a non-RDS remote target', () => {
    configureRemote({ DATABASE_URL:'postgresql://user:password@db.example.com:5432/american_latin_class' });
    expect(() => assertAcademicDemoSeed('Defense reset')).toThrow('AWS RDS');
  });

  test('rejects a database-name mismatch', () => {
    configureRemote({ REMOTE_DEMO_SEED_DATABASE:'another_database' });
    expect(() => assertAcademicDemoSeed('Defense reset')).toThrow('does not match');
  });

  test('accepts the exact controlled RDS confirmation', () => {
    configureRemote();
    expect(() => assertAcademicDemoSeed('Defense reset')).not.toThrow();
  });
});
