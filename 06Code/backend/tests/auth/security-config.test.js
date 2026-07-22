const { buildEnv, validateRuntimeEnv } = require('../../src/config/env');
const { createDatabaseContext } = require('../../src/repositories/createDatabaseContext');

const deployedBase = {
  NODE_ENV:'production',
  DB_DRIVER:'prisma',
  DATABASE_URL:'postgresql://app:placeholder@db.internal:5432/academy',
  SESSION_SECRET:'a-production-secret-with-at-least-32-characters',
  GOOGLE_CLIENT_ID:'configured-google-client-id',
  CORS_ORIGINS:'https://academy.example.invalid',
  EMAIL_TRANSPORT:'smtp',
  SMTP_HOST:'smtp.example.invalid',
  EMAIL_FROM:'American Latin Class <no-reply@example.invalid>',
  APP_PUBLIC_URL:'https://academy.example.invalid',
};

describe('fail-closed runtime configuration', () => {
  test('a database driver typo fails startup instead of selecting memory', () => {
    const config = buildEnv({ ...deployedBase, DB_DRIVER:'prsim' });
    expect(() => validateRuntimeEnv(config)).toThrow(/Unsupported DB_DRIVER/);
    expect(() => createDatabaseContext({ ...config, nodeEnv:'test' })).toThrow(/Unsupported DB_DRIVER/);
    expect(() => validateRuntimeEnv(buildEnv({ NODE_ENV:'test', DB_DRIVER:'prsim' }))).toThrow(/Unsupported DB_DRIVER/);
  });

  test('memory storage requires an explicit local-development opt-in', () => {
    const unsafe = buildEnv({
      NODE_ENV:'development',
      DB_DRIVER:'memory',
      SESSION_SECRET:'a-development-secret-with-at-least-32-characters',
    });
    expect(() => validateRuntimeEnv(unsafe)).toThrow(/in-memory database/);

    const explicit = buildEnv({
      NODE_ENV:'development',
      DB_DRIVER:'memory',
      ALLOW_IN_MEMORY_DB:'true',
      SESSION_SECRET:'a-development-secret-with-at-least-32-characters',
    });
    expect(validateRuntimeEnv(explicit)).toMatchObject({ databaseDriver:'memory', host:'127.0.0.1' });
    expect(validateRuntimeEnv(buildEnv(deployedBase)).host).toBe('0.0.0.0');
  });

  test('rejects HOST values containing a URL or path', () => {
    expect(() => validateRuntimeEnv(buildEnv({ ...deployedBase, HOST:'https://0.0.0.0/app' }))).toThrow(/HOST/);
  });

  test.each([
    ['ALLOW_MOCK_GOOGLE_TOKENS', 'true'],
    ['POSTMAN_LOGIN_ENABLED', 'true'],
    ['EXPOSE_SESSION_TOKEN', 'true'],
  ])('%s is blocked in production', (flag, value) => {
    const config = buildEnv({ ...deployedBase, [flag]:value });
    expect(() => validateRuntimeEnv(config)).toThrow(/forbidden/);
  });

  test('production rejects non-HTTPS browser origins', () => {
    const config = buildEnv({ ...deployedBase, CORS_ORIGINS:'http://academy.example.invalid' });
    expect(() => validateRuntimeEnv(config)).toThrow(/must use HTTPS/);
  });

  test('production requires SMTP delivery and an HTTPS public URL', () => {
    expect(() => validateRuntimeEnv(buildEnv({ ...deployedBase, EMAIL_TRANSPORT:'capture' }))).toThrow(/SMTP email delivery/);
    expect(() => validateRuntimeEnv(buildEnv({ ...deployedBase, APP_PUBLIC_URL:'http://academy.example.invalid' }))).toThrow(/APP_PUBLIC_URL must use HTTPS/);
  });
});
