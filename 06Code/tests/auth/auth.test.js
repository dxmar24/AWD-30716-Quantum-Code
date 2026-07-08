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

  test('registered Google login and logout invalidate session', async () => {
    const app = createApp();
    const idToken = jwt.sign({ sub:'test-student', email:'student@alc.edu', name:'Demo Student User', aud:'test-google-client-id' }, 'x');
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

  test('Google login does not create unregistered academy users', async () => {
    const app = createApp();
    const idToken = jwt.sign({ sub:'google-unregistered', email:'new@alc.edu', name:'New User', aud:'test-google-client-id' }, 'x');

    await request(app).post('/api/v1/auth/google').send({ idToken }).expect(401);
  });

  test('Google login rejects unverified email addresses', async () => {
    const app = createApp();
    const idToken = jwt.sign({ sub:'google-unverified', email:'student@alc.edu', name:'Demo Student User', aud:'test-google-client-id', email_verified:false }, 'x');

    const response = await request(app).post('/api/v1/auth/google').send({ idToken }).expect(401);
    expect(response.body.details.code).toBe('GOOGLE_EMAIL_NOT_VERIFIED');
  });

  test('Google login links an existing email without creating a new user', async () => {
    const app = createApp();
    app.locals.db.users.create({
      email:'linked@alc.edu',
      name:'Linked Student',
      role:Roles.STUDENT,
      active:true,
    });

    const idToken = jwt.sign({ sub:'google-linked', email:'linked@alc.edu', name:'Linked Student', aud:'test-google-client-id' }, 'x');
    const login = await request(app).post('/api/v1/auth/google').send({ idToken }).expect(200);

    expect(login.body.data.user.email).toBe('linked@alc.edu');
    expect(app.locals.db.users.findBy('email', 'linked@alc.edu').googleSub).toBe('google-linked');
  });

  test('Google login rejects a linked account when the Google email changes', async () => {
    const app = createApp();
    const idToken = jwt.sign({ sub:'test-student', email:'different@alc.edu', name:'Demo Student User', aud:'test-google-client-id' }, 'x');

    const response = await request(app).post('/api/v1/auth/google').send({ idToken }).expect(409);
    expect(response.body.details.code).toBe('GOOGLE_EMAIL_MISMATCH');
  });

  test('Google login does not link inactive academy accounts', async () => {
    const app = createApp();
    app.locals.db.users.create({
      email:'inactive@alc.edu',
      name:'Inactive Student',
      role:Roles.STUDENT,
      active:false,
    });
    const idToken = jwt.sign({ sub:'inactive-google', email:'inactive@alc.edu', name:'Inactive Student', aud:'test-google-client-id' }, 'x');

    await request(app).post('/api/v1/auth/google').send({ idToken }).expect(401);
    expect(app.locals.db.users.findBy('email', 'inactive@alc.edu').googleSub).toBeUndefined();
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

  test('temporary password requires a password change before protected flows', async () => {
    const app = createApp();
    app.locals.db.users.create({
      email:'firstlogin@alc.edu',
      name:'First Login Student',
      role:Roles.STUDENT,
      active:true,
      mustChangePassword:true,
      passwordHash:hashPassword('temporaryALC2026*'),
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email:'firstlogin@alc.edu', password:'temporaryALC2026*' })
      .expect(200);

    const sessionToken = login.body.data.sessionToken;
    expect(login.body.data.user.mustChangePassword).toBe(true);

    const blocked = await request(app)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(403);
    expect(blocked.body.details.code).toBe('PASSWORD_CHANGE_REQUIRED');

    await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ currentPassword:'wrong-password', newPassword:'studentALC2027*' })
      .expect(401);

    const changed = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ currentPassword:'temporaryALC2026*', newPassword:'studentALC2027*' })
      .expect(200);

    expect(changed.body.data.user.mustChangePassword).toBe(false);
    await request(app).get('/api/v1/roles').set('Authorization', `Bearer ${sessionToken}`).expect(200);
    await request(app).post('/api/v1/auth/login').send({ email:'firstlogin@alc.edu', password:'temporaryALC2026*' }).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email:'firstlogin@alc.edu', password:'studentALC2027*' }).expect(200);
  });

  test('director can create an academy account with a temporary password', async () => {
    const app = createApp();
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email:'admin@alc.edu', password:'AmericanLatin2026!' })
      .expect(200);

    const created = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminLogin.body.data.sessionToken}`)
      .send({
        email:'created.student@alc.edu',
        name:'Created Student',
        role:Roles.STUDENT,
        studentProfile:{ branchId:'11111111-1111-4111-8111-111111111111', level:'B1' },
      })
      .expect(201);

    expect(created.body.data.user.email).toBe('created.student@alc.edu');
    expect(created.body.data.user.passwordHash).toBeUndefined();
    expect(created.body.data.user.mustChangePassword).toBe(true);
    expect(created.body.data.profile.userId).toBe(created.body.data.user.id);
    expect(created.body.data.temporaryPassword).toMatch(/^ALC-/);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email:'created.student@alc.edu', password:created.body.data.temporaryPassword })
      .expect(200);
    expect(login.body.data.user.mustChangePassword).toBe(true);
  });

  test('account creation validates branch assignments before creating a user', async () => {
    const app = createApp();
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email:'admin@alc.edu', password:'AmericanLatin2026!' })
      .expect(200);

    await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminLogin.body.data.sessionToken}`)
      .send({
        email:'invalid.branch@alc.edu',
        name:'Invalid Branch User',
        role:Roles.BRANCH_DIRECTOR,
        branchIds:['99999999-9999-4999-8999-999999999999'],
      })
      .expect(404);

    expect(app.locals.db.users.findBy('email', 'invalid.branch@alc.edu')).toBeNull();
  });

  test('invalid Google token is rejected', async () => {
    const app = createApp();
    await request(app).post('/api/v1/auth/google').send({ idToken:'not-a-valid-google-token' }).expect(401);
  });

  test('expired session is rejected', async () => {
    const app = createApp();
    const idToken = jwt.sign({ sub:'test-admin', email:'admin@alc.edu', name:'Admin User', aud:'test-google-client-id' }, 'x');
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
    const idToken = jwt.sign({ sub:'test-admin', email:'admin@alc.edu', name:'Admin User', aud:'test-google-client-id' }, 'x');
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
