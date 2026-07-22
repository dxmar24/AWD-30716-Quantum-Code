const request = require('supertest');
const { createApp } = require('../../src/app');
const { env } = require('../../src/config/env');

function cookieValue(setCookies, name) {
  const cookie = setCookies.find((value) => value.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split(';', 1)[0].slice(name.length + 1)) : null;
}

describe('HTTP security middleware', () => {
  test('exposes sanitized liveness and database-backed readiness probes', async () => {
    const app = createApp();
    const live = await request(app).get('/api/v1/health/live').expect(200);
    expect(live.body).toMatchObject({ success:true, status:'ok', service:'american-latin-class-api' });
    expect(live.body.requestId).toBe(live.headers['x-request-id']);

    const ready = await request(app).get('/api/v1/health/ready').expect(200);
    expect(ready.body).toMatchObject({ success:true, status:'ready', dependencies:{ database:'up' } });

    app.locals.db.roles.all = jest.fn().mockRejectedValue(new Error('sensitive connection detail'));
    const unavailable = await request(app).get('/api/v1/health/ready').expect(503);
    expect(unavailable.body).toMatchObject({ success:false, status:'not_ready', dependencies:{ database:'down' } });
    expect(JSON.stringify(unavailable.body)).not.toContain('sensitive connection detail');

    const missing = await request(app).get('/api/v1/unknown-route').expect(404);
    expect(missing.body).toMatchObject({ success:false, message:'API route not found' });
    expect(missing.body.requestId).toBe(missing.headers['x-request-id']);
  });

  test('sets a safe request correlation id and ignores malformed supplied ids', async () => {
    const app = createApp();
    await request(app)
      .get('/api/v1/auth/config')
      .set('X-Request-ID', 'audit-123')
      .expect('X-Request-ID', 'audit-123')
      .expect(200);

    const generated = await request(app)
      .get('/api/v1/auth/config')
      .set('X-Request-ID', 'invalid request id with spaces')
      .expect(200);
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('propagates sanitized HTTP context into atomic audit records', async () => {
    const app = createApp();
    await request(app)
      .post('/api/v1/auth/login')
      .set('X-Request-ID', 'audit-context-123')
      .set('User-Agent', 'ALC security verification')
      .send({ email:'admin@alc.edu', password:'AmericanLatin2026!' })
      .expect(200);

    const logs = await app.locals.db.auditLogs.all();
    const login = logs.find((row) => row.action === 'AUTH_LOGIN_PASSWORD');
    expect(login?.metadata?.request).toMatchObject({
      requestId:'audit-context-123',
      userAgent:'ALC security verification',
      method:'POST',
      path:'/api/v1/auth/login',
    });
    expect(login?.metadata?.request?.ip).toBeTruthy();
  });

  test('cookie-authenticated mutations require allowed Origin and matching CSRF token', async () => {
    const previous = env.csrfProtectionEnabled;
    env.csrfProtectionEnabled = true;
    try {
      const app = createApp();
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email:'admin@alc.edu', password:'AmericanLatin2026!' })
        .expect(200);
      const cookies = login.headers['set-cookie'];
      const csrfToken = cookieValue(cookies, 'alc_csrf');
      expect(csrfToken).toBeTruthy();

      await request(app).post('/api/v1/auth/logout').set('Cookie', cookies).expect(403);
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookies)
        .set('Origin', env.corsOrigins[0])
        .set('X-CSRF-Token', 'incorrect')
        .expect(403);
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookies)
        .set('Origin', env.corsOrigins[0])
        .set('X-CSRF-Token', csrfToken)
        .expect(200);
    } finally {
      env.csrfProtectionEnabled = previous;
    }
  });

  test('session tokens are omitted when response-token exposure is disabled', async () => {
    const previous = env.exposeSessionToken;
    env.exposeSessionToken = false;
    try {
      const app = createApp();
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email:'admin@alc.edu', password:'AmericanLatin2026!' })
        .expect(200);
      expect(login.body.data.sessionToken).toBeUndefined();
      expect(login.body.data.tokenType).toBeUndefined();
      expect(login.headers['set-cookie'].some((cookie) => cookie.startsWith('alc_session='))).toBe(true);
    } finally {
      env.exposeSessionToken = previous;
    }
  });

  test('rejects oversized JSON bodies', async () => {
    const app = createApp();
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email:'admin@alc.edu', password:'x'.repeat(env.jsonBodyLimitBytes + 1) })
      .expect(413);
  });
});
