const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/app');

describe('auth/session', () => {
  test('login and logout invalidate session', async () => {
    const app = createApp();
    const idToken = jwt.sign({ sub:'google-1', email:'new@alc.edu', name:'New User', aud:'test-google-client-id' }, 'x');
    const login = await request(app).post('/api/v1/auth/google').send({ idToken }).expect(200);
    const cookie = login.headers['set-cookie'][0];

    await request(app).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(200);
    await request(app).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
  });

  test('invalid Google token is rejected', async () => {
    const app = createApp();
    await request(app).post('/api/v1/auth/google').send({ idToken:'not-a-valid-google-token' }).expect(401);
  });

  test('expired session is rejected', async () => {
    const app = createApp();
    const idToken = jwt.sign({ sub:'google-expired', email:'expired@alc.edu', name:'Expired User', aud:'test-google-client-id' }, 'x');
    const login = await request(app).post('/api/v1/auth/google').send({ idToken }).expect(200);
    const session = app.locals.db.sessions.all()[0];
    app.locals.db.sessions.update(session.id, { expiresAt:'2000-01-01T00:00:00.000Z' });

    await request(app).get('/api/v1/auth/me').set('Cookie', login.headers['set-cookie'][0]).expect(401);
  });

  test('private paths redirect without a session and send no-store headers', async () => {
    const app = createApp();
    await request(app)
      .get('/private/dashboard.html')
      .expect('Cache-Control', /no-store/)
      .expect('Location', /session=expired/)
      .expect(302);
  });

  test('private dashboard is available with a valid session', async () => {
    const app = createApp();
    const idToken = jwt.sign({ sub:'google-private', email:'private@alc.edu', name:'Private User', aud:'test-google-client-id' }, 'x');
    const login = await request(app).post('/api/v1/auth/google').send({ idToken }).expect(200);

    const response = await request(app)
      .get('/private/dashboard.html')
      .set('Cookie', login.headers['set-cookie'][0])
      .expect('Cache-Control', /no-store/)
      .expect(200);

    expect(response.text).toContain('id="root"');
    expect(response.text).not.toContain('/private/dashboard.js');
  });
});
