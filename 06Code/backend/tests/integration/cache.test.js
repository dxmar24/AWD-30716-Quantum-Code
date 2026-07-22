const request = require('supertest');
const { createApp } = require('../../src/app');

async function loginAdmin(app) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email:'admin@alc.edu', password:'AmericanLatin2026!' })
    .expect(200);
  return response.body.data.sessionToken;
}

describe('controlled cache management', () => {
  test('auth config is cacheable but session data is no-store', async () => {
    const app = createApp();

    const config = await request(app).get('/api/v1/auth/config').expect(200);
    expect(config.headers['cache-control']).toContain('public');
    expect(config.headers['cache-control']).toContain('max-age=3600');
    expect(config.headers['x-cache-policy']).toBe('public-auth-config');

    const me = await request(app).get('/api/v1/auth/me').expect(401);
    expect(me.headers['cache-control']).toContain('no-store');
    expect(me.headers['x-cache-policy']).toBe('sensitive-no-store');
  });

  test('reference lists use memory cache with visible hit and miss headers', async () => {
    const app = createApp();
    const token = await loginAdmin(app);

    const first = await request(app)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(first.headers['cache-control']).toContain('private');
    expect(first.headers['x-cache-policy']).toBe('private-reference-roles');
    expect(first.headers['x-memory-cache']).toBe('MISS');

    const second = await request(app)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(second.headers['x-memory-cache']).toBe('HIT');
    expect(second.headers['x-memory-cache-ttl']).toBeDefined();
  });

  test('academic writes invalidate related cached lists', async () => {
    const app = createApp();
    const token = await loginAdmin(app);

    await request(app)
      .get('/api/v1/branches')
      .set('Authorization', `Bearer ${token}`)
      .expect('X-Memory-Cache', 'MISS')
      .expect(200);

    await request(app)
      .get('/api/v1/branches')
      .set('Authorization', `Bearer ${token}`)
      .expect('X-Memory-Cache', 'HIT')
      .expect(200);

    await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${token}`)
      .send({ name:`Cache Test Branch ${Date.now()}`, city:'Quito', active:true })
      .expect(201);

    await request(app)
      .get('/api/v1/branches')
      .set('Authorization', `Bearer ${token}`)
      .expect('X-Memory-Cache', 'MISS')
      .expect(200);
  });

  test('scoped branch reports are cached per authenticated actor', async () => {
    const app = createApp();
    const token = await loginAdmin(app);

    await request(app)
      .get('/api/v1/reports/branches/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect('X-Memory-Cache', 'MISS')
      .expect(200);

    await request(app)
      .get('/api/v1/reports/branches/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect('X-Memory-Cache', 'HIT')
      .expect(200);
  });
});
