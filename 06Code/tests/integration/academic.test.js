const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/app');

async function login(app, payload = {}) {
  const idToken = jwt.sign({
    sub:'test-admin',
    email:'admin@alc.edu',
    name:'Admin User',
    aud:'test-google-client-id',
    ...payload,
  }, 'x');
  const response = await request(app).post('/api/v1/auth/google').send({ idToken }).expect(200);
  return { cookie:response.headers['set-cookie'][0], user:response.body.data.user };
}

test('visitor can submit enrollment request and directors can list it', async () => {
  const app = createApp();
  const { cookie } = await login(app);

  await request(app)
    .post('/api/v1/enrollment-requests')
    .send({ fullName:'Public Visitor', email:'visitor@example.com', preferredBranch:'Norte', styleInterest:'Salsa' })
    .expect(201);

  const list = await request(app).get('/api/v1/enrollment-requests').set('Cookie', cookie).expect(200);
  expect(list.body.data).toHaveLength(1);
});

test('attendance prevents duplicated student and session records', async () => {
  const app = createApp();
  const { cookie } = await login(app);
  const body = {
    studentId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    classSessionId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    status:'present',
  };

  await request(app).post('/api/v1/student-attendance').set('Cookie', cookie).send(body).expect(201);
  await request(app).post('/api/v1/student-attendance').set('Cookie', cookie).send(body).expect(409);
});

test('directors can review absence justifications', async () => {
  const app = createApp();
  const { cookie } = await login(app);
  const attendance = await request(app).post('/api/v1/student-attendance').set('Cookie', cookie).send({
    studentId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    classSessionId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    status:'absent',
  }).expect(201);

  const justification = await request(app).post('/api/v1/absence-justifications').set('Cookie', cookie).send({
    attendanceRecordId:attendance.body.data.id,
    reason:'Medical appointment',
  }).expect(201);

  await request(app).patch(`/api/v1/absence-justifications/${justification.body.data.id}/review`).set('Cookie', cookie).send({
    status:'approved',
    reviewNotes:'Evidence accepted',
  }).expect(200);
});

test('scholarship and promotion evaluations require candidate rules plus evaluation scores', async () => {
  const app = createApp();
  const { cookie } = await login(app);
  const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  app.locals.db.studentAttendance.create({ studentId, classSessionId:'11111111-2222-4333-8444-555555555555', status:'present' });
  app.locals.db.studentAttendance.create({ studentId, classSessionId:'11111111-2222-4333-8444-666666666666', status:'present' });
  app.locals.db.studentAttendance.create({ studentId, classSessionId:'11111111-2222-4333-8444-777777777777', status:'late' });

  await request(app).post('/api/v1/scholarship-evaluations').set('Cookie', cookie).send({
    studentId,
    percentage:50,
    theoryScore:80,
    practiceScore:85,
    approved:true,
  }).expect(201);

  await request(app).post('/api/v1/level-promotion-evaluations').set('Cookie', cookie).send({
    studentId,
    consistencyScore:90,
    theoryScore:88,
    practiceScore:91,
    approved:true,
  }).expect(201);

  expect(app.locals.db.students.findById(studentId).level).toBe('B2');
});
