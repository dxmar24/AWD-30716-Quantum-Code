const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/app');
const { Roles } = require('../../src/models/constants');
const { hashPassword } = require('../../src/utils/passwordHasher');

describe('auth/session', () => {
  test('auth config exposes the Google client id without requiring a session', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/auth/config').expect(200);

    expect(response.body.data.googleClientId).toBe('test-google-client-id');
  });

  test('login and logout invalidate session', async () => {
    const app = createApp();
    const idToken = jwt.sign({ sub:'google-1', email:'new@alc.edu', name:'New User', aud:'test-google-client-id' }, 'x');
    const login = await request(app).post('/api/v1/auth/google').send({ idToken }).expect(200);
    const cookie = login.headers['set-cookie'][0];
    const sessionToken = login.body.data.sessionToken;

    expect(sessionToken).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
    expect(login.body.data.tokenType).toBe('Bearer');
    await request(app).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${sessionToken}`).expect(200);
    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(200);
    await request(app).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${sessionToken}`).expect(401);
  });

  test('Postman password login returns a revocable bearer token', async () => {
    const app = createApp();

    await request(app).get('/api/v1/auth/me').expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email:'admin@alc.edu', password:'wrong-password' })
      .expect(401);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email:'admin@alc.edu', password:'AmericanLatin2026!' })
      .expect(200);

    const sessionToken = login.body.data.sessionToken;
    expect(sessionToken).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
    expect(login.body.data.tokenType).toBe('Bearer');
    expect(login.body.data.user.email).toBe('admin@alc.edu');

    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${sessionToken}`).expect(200);
    await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${sessionToken}`).expect(200);
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${sessionToken}`).expect(401);
  });

  test('seeded password hash login supports role-specific users', async () => {
    const app = createApp();
    app.locals.db.users.create({
      email:'branchdirector@alc.edu',
      name:'ALC Branch Director',
      role:Roles.BRANCH_DIRECTOR,
      active:true,
      passwordHash:hashPassword('branchdirectorALC2026*'),
    });

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email:'branchdirector@alc.edu', password:'wrong-password' })
      .expect(401);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email:'branchdirector@alc.edu', password:'branchdirectorALC2026*' })
      .expect(200);

    const sessionToken = login.body.data.sessionToken;
    expect(login.body.data.user.role).toBe(Roles.BRANCH_DIRECTOR);
    expect(login.body.data.user.passwordHash).toBeUndefined();

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(200);

    expect(me.body.data.user.role).toBe(Roles.BRANCH_DIRECTOR);
    expect(me.body.data.user.passwordHash).toBeUndefined();
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
      .expect('Location', '/login.html?session=expired')
      .expect(302);
  });

  test('login page is public and served by the React app', async () => {
    const app = createApp();
    const response = await request(app).get('/login.html').expect(200);

    expect(response.text).toContain('id="root"');
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
